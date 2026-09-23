# Media hosting plan

The IDunnoPoetry Museum currently catalogs **136 creative media assets** across **50 reconciled canonical works**, totaling approximately **3583.52 MB**.

## Recommended host: Cloudflare R2 Standard

Checked September 23, 2026. Cloudflare R2's published Standard free tier includes 10 GB-month of storage, 1 million Class A operations, 10 million Class B operations, and free Internet egress. The current ~3.58 GB archive fits inside the storage allowance.

Official pricing: https://developers.cloudflare.com/r2/pricing/

R2 is preferable to placing the full media library in the Git repository because several source videos exceed 100 MB and the complete collection is measured in gigabytes.

## Museum integration

The public-safe file `media-upload-manifest.json` assigns every asset a deterministic object key:

```
media/<canonical-work-slug>/<asset-id>-<sanitized-filename>
```

The original private Google Drive ID mapping remains only in the Master Creative Archive spreadsheet.

After the objects are uploaded to R2:

1. Enable a public R2 domain or custom domain.
2. Set `IDP_CONFIG.mediaBaseUrl` in `museum-config.js` to that base URL.
3. The museum's media renderer automatically resolves each `objectKey` against that base URL.
4. Assets explicitly shipped inside the museum itself can continue using `publicPath`, which takes precedence over the external host.

No poem records need to be rewritten when the host changes.

## Current public media

One small proof-of-path asset is already shipped directly with the museum:

- I Love You More — lyric image

Large audio/video files remain cataloged but private until deliberately uploaded.

## Duplicate handling

The source catalog currently flags **6 duplicate candidates**. Do not delete either copy based solely on filename/size; compare content hashes after upload preparation and preserve distinct versions when they differ.
