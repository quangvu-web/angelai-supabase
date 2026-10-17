import { Link } from "@/lib/router-compat";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layouts/AppLayout";
import constitution from "@/content/digital-constitution.txt?raw";
import { useLanguage } from "@/contexts/LanguageContext";

const [opening, ...articles] = constitution.split(/(?=^ĐIỀU [1-5]:)/m);
const articleHeadings = articles.map((article, index) => ({
  id: `dieu-${index + 1}`,
  heading: article.split("\n", 1)[0].trim(),
  content: article.slice(article.indexOf("\n") + 1).trim(),
}));

function ArticleBody({ text }: { text: string }) {
  return (
    <div className="space-y-5 text-foreground/85 leading-8">
      {text.split(/\n\s*\n/).filter((part) => part.trim() && !/^———\s*$/.test(part.trim())).map((part, index) => {
        const numbered = /^(\d+)\.\s/.exec(part.trim());
        return numbered ? (
          <div key={index} className="flex gap-4 border-l-2 border-primary/30 pl-4 sm:pl-6">
            <span className="shrink-0 font-bold text-primary" aria-hidden="true">{numbered[1].padStart(2, "0")}</span>
            <p className="min-w-0 whitespace-pre-line break-words">{part.trim().slice(numbered[0].length)}</p>
          </div>
        ) : (
          <p key={index} className="whitespace-pre-line break-words">{part.trim()}</p>
        );
      })}
    </div>
  );
}

export default function DigitalConstitution() {
  const { t } = useLanguage();
  const [title, subtitle, prefaceHeading, ...prefaceText] = opening.trim().split("\n").filter((line) => line.trim() && !/^———\s*$/.test(line.trim()));

  return (
    <AppLayout>
      <div className="bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
          <Link to="/about" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:text-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <ArrowLeft className="h-4 w-4" /> {t("docs.backAbout")}
          </Link>

          <header className="mt-10 border-b border-border pb-10 sm:pb-14">
            <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase text-primary">
              <BookOpen className="h-5 w-5" /> {t("docs.foundationBadge")}
            </div>
            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-foreground sm:text-5xl">{title}</h1>
            <p className="mt-4 text-sm font-semibold uppercase text-muted-foreground sm:text-base">{subtitle}</p>
          </header>

          <div className="grid gap-10 pt-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
            <nav aria-label={t("docs.toc")} className="lg:sticky lg:top-8 lg:self-start">
              <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">{t("docs.toc")}</p>
              <div className="flex flex-col border-l border-border">
                <a href="#loi-mo-dau" className="flex min-h-11 items-center gap-2 border-l-2 border-transparent px-4 text-sm text-foreground hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" /> {t("docs.preface")}
                </a>
                {articleHeadings.map(({ id }, index) => (
                  <a key={id} href={`#${id}`} className="flex min-h-11 items-center gap-2 border-l-2 border-transparent px-4 text-sm text-foreground hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" /> {t("docs.article", { number: index + 1 })}
                  </a>
                ))}
              </div>
            </nav>

            <article className="min-w-0">
              <section id="loi-mo-dau" className="scroll-mt-8 border-b border-border pb-10">
                <h2 className="mb-6 text-2xl font-bold text-primary-deep">{prefaceHeading}</h2>
                <ArticleBody text={prefaceText.join("\n")} />
              </section>
              {articleHeadings.map(({ id, heading, content }) => (
                <section key={id} id={id} className="scroll-mt-8 border-b border-border py-10 sm:py-12">
                  <h2 className="mb-7 text-xl font-bold leading-snug text-primary-deep sm:text-2xl">{heading}</h2>
                  <ArticleBody text={content} />
                </section>
              ))}
            </article>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}