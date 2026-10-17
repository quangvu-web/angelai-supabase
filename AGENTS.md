<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Code copied from ANGEL AI imports routing helpers from `@/lib/router-compat` (react-router-style API on TanStack Router); keep using it instead of adding react-router-dom.
- `@/integrations/supabase/client` is an offline stub returning empty data, because the app is intentionally not connected to a database yet.
- Root layout renders app providers inside `<ClientOnly>` because the copied code relies on browser-only APIs.
