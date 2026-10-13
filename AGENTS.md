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

## Application rules
- Journal data is private and owner-scoped by database policies; never expose another operator’s trades.
- The journal uses a client-only root route with Query loader caching because private sessions are browser-held; signed-out visitors see explicitly labeled illustrative data.
- Trade calculations live in the shared trades module, so summaries, charts and exports use the same net-of-fees P&L.
- Shared theme styling lives in the global design system and UI controls use the existing design components.
