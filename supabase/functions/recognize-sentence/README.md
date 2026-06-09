# Sentence OCR Edge Function

This function sends a resized image to NAVER Cloud CLOVA OCR and returns only
the recognized text. The image is not stored in Supabase Storage or the
database.

## Required secrets

Create a General OCR domain in NAVER Cloud CLOVA OCR, then register its invoke
URL and secret in Supabase:

```bash
supabase secrets set CLOVA_OCR_INVOKE_URL="https://.../general"
supabase secrets set CLOVA_OCR_SECRET="..."
```

## Deploy

```bash
supabase functions deploy recognize-sentence
```
