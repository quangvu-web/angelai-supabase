import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing Google URL:', url);

    let docId = '';
    let sourceType = '';

    // Detect Google Docs URL
    if (url.includes('docs.google.com/document')) {
      const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        return new Response(
          JSON.stringify({ error: 'Invalid Google Docs URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      docId = match[1];
      sourceType = 'google_docs';
    }
    // Detect Google Sheets URL
    else if (url.includes('docs.google.com/spreadsheets')) {
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        return new Response(
          JSON.stringify({ error: 'Invalid Google Sheets URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      docId = match[1];
      sourceType = 'google_sheets';
    }
    else {
      return new Response(
        JSON.stringify({ 
          error: 'Unsupported URL. Please use Google Docs or Google Sheets URL.',
          hint: 'URL should contain docs.google.com/document or docs.google.com/spreadsheets'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try multiple methods to fetch content
    let content: string | null = null;
    let method = '';

    if (sourceType === 'google_docs') {
      // Method 1: Export as txt with manual redirect
      content = await tryFetchWithManualRedirect(
        `https://docs.google.com/document/d/${docId}/export?format=txt`
      );
      method = 'export_txt';

      // Method 2: Fetch published HTML and strip tags
      if (!content) {
        console.log('Method 1 failed, trying /pub HTML fallback...');
        content = await tryFetchPublishedHTML(
          `https://docs.google.com/document/d/${docId}/pub`
        );
        method = 'pub_html';
      }

      // Method 3: Fetch as mobilebasic (lightweight HTML)
      if (!content) {
        console.log('Method 2 failed, trying mobilebasic fallback...');
        content = await tryFetchPublishedHTML(
          `https://docs.google.com/document/d/${docId}/mobilebasic`
        );
        method = 'mobilebasic';
      }
    } else {
      // Google Sheets
      // Method 1: Export as CSV with manual redirect
      content = await tryFetchWithManualRedirect(
        `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`
      );
      method = 'export_csv';

      // Method 2: gviz CSV endpoint
      if (!content) {
        console.log('Method 1 failed, trying gviz fallback...');
        content = await tryFetchWithManualRedirect(
          `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv`
        );
        method = 'gviz_csv';
      }

      // Method 3: Published HTML
      if (!content) {
        console.log('Method 2 failed, trying /pub HTML fallback...');
        content = await tryFetchPublishedHTML(
          `https://docs.google.com/spreadsheets/d/${docId}/pub?output=html`
        );
        method = 'pub_html';
      }
    }

    if (!content) {
      return new Response(
        JSON.stringify({ 
          error: 'Không thể tải nội dung từ Google. Vui lòng kiểm tra file đã được chia sẻ công khai.',
          hint: 'Mở file trong Google Drive → Nhấn "Chia sẻ" → Chọn "Bất kỳ ai có liên kết"'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Content fetched successfully via ${method}, length: ${content.length}`);

    // Format content
    let formattedContent = content;
    if (sourceType === 'google_sheets' && method !== 'pub_html') {
      formattedContent = formatCSVContent(content);
    }

    return new Response(
      JSON.stringify({ 
        content: formattedContent,
        rawContent: content,
        sourceType,
        contentType: sourceType === 'google_sheets' ? 'text/csv' : 'text/plain',
        contentLength: content.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fetch with manual redirect handling to avoid HTTP/2 stream errors
async function tryFetchWithManualRedirect(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1}: Fetching ${url} (manual redirect)`);
      
      const response = await fetch(url, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)',
          'Accept': 'text/plain, text/csv, */*',
        },
      });

      // Handle redirect manually
      if (response.status === 301 || response.status === 302 || response.status === 307) {
        const redirectUrl = response.headers.get('location');
        // Consume the body to prevent resource leak
        await response.text();
        
        if (redirectUrl) {
          console.log('Following redirect to:', redirectUrl.substring(0, 80) + '...');
          
          const redirectResponse = await fetch(redirectUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)',
              'Accept': '*/*',
            },
          });

          if (redirectResponse.ok) {
            const text = await redirectResponse.text();
            if (text && text.length > 0) return text;
          } else {
            await redirectResponse.text();
            console.error('Redirect fetch failed:', redirectResponse.status);
          }
        }
      } else if (response.ok) {
        const text = await response.text();
        if (text && text.length > 0) return text;
      } else {
        await response.text();
        console.error(`Fetch failed: ${response.status} ${response.statusText}`);
        
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          return null; // Don't retry auth/not found errors
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} error:`, error instanceof Error ? error.message : error);
    }
    
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// Fetch published HTML version and strip tags to extract text
async function tryFetchPublishedHTML(url: string): Promise<string | null> {
  try {
    console.log('Fetching published HTML:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      await response.text();
      console.error('Published HTML fetch failed:', response.status);
      return null;
    }

    const html = await response.text();
    if (!html || html.length === 0) return null;

    // Strip HTML tags and extract text content
    const text = stripHTML(html);
    return text.length > 10 ? text : null;
  } catch (error) {
    console.error('Published HTML error:', error instanceof Error ? error.message : error);
    return null;
  }
}

// Strip HTML tags and clean up text
function stripHTML(html: string): string {
  // Remove script and style blocks
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Replace br/p/div/tr tags with newlines
  text = text.replace(/<(?:br|p|div|tr|li|h[1-6])[^>]*\/?>/gi, '\n');
  // Replace td/th with tab
  text = text.replace(/<(?:td|th)[^>]*>/gi, '\t');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  return text.trim();
}

// Format CSV content for AI readability
function formatCSVContent(csvText: string): string {
  const lines = csvText.split('\n');
  if (lines.length === 0) return csvText;

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).filter(line => line.trim()).map(parseCSVLine);

  let formatted = `📊 BẢNG DỮ LIỆU (${rows.length} dòng)\n`;
  formatted += `${'─'.repeat(50)}\n`;
  formatted += `Các cột: ${headers.join(' | ')}\n`;
  formatted += `${'─'.repeat(50)}\n\n`;

  rows.forEach((row, index) => {
    formatted += `--- Dòng ${index + 1} ---\n`;
    headers.forEach((header, i) => {
      const value = row[i] || '';
      if (value) {
        formatted += `${header}: ${value}\n`;
      }
    });
    formatted += '\n';
  });

  return formatted;
}
