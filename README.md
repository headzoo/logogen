## LogoGen

A simple AI logo generator built with React and Cloudflare Workers.

## Features

- Generate logos with AI
- Download logos
- Share logos
- Save logos to your collection

## Deployment

Pushes to `main` trigger the [Deploy to Cloudflare](.github/workflows/deploy.yml) GitHub Action, which builds the site, applies pending D1 migrations, and deploys the Worker.

### GitHub repository secrets

Configure these under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Workers Scripts (Edit)**, **D1 (Edit)**, **Workers R2 Storage (Edit)**, and **Account Settings (Read)** |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

### Runtime secrets

Worker runtime secrets such as `OPENAI_API_KEY` are not stored in GitHub. Set them once with:

```bash
wrangler secret put OPENAI_API_KEY
```

You can also trigger a deploy manually from the **Actions** tab using **Run workflow**.
