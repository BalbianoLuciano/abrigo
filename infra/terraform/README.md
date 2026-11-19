# Infraestructura (GCP) — escrita, todavía sin aplicar

1. Crear el proyecto y el bucket de estado: `gsutil mb -l southamerica-east1 gs://<proyecto>-tfstate`.
2. `cp terraform.tfvars.example terraform.tfvars` y completar.
3. `terraform init -backend-config="bucket=<proyecto>-tfstate"` y `terraform apply`.
   El primer apply necesita una imagen existente en `var.image` (subir una a mano o usar una pública temporal).
4. Cargar los secretos manuales:
   `MESSAGE_KEYS` (claves de datos envueltas con la clave KMS `messages`), `TURNSTILE_SECRET_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SMTP_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (todos necesitan al menos una versión para que Cloud Run arranque):
   `printf '%s' "$VALOR" | gcloud secrets versions add abrigo-<nombre> --data-file=-`.
5. Apuntar los registros A de los dominios a `load_balancer_ip`.
6. En GitHub (environment `production`), definir las variables `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOYER_SA`, `GCP_ARTIFACT_REGISTRY`, `GCP_WEB_BUCKET`, `PUBLIC_API_URL`, `TURNSTILE_SITE_KEY` y `GOOGLE_MAPS_KEY` (Maps JavaScript API restringida al dominio de la PWA).
7. Registrar el webhook del bot: `curl "https://api.telegram.org/bot$TOKEN/setWebhook" -d url=https://<api_domain>/v1/telegram/webhook -d secret_token=$SECRETO -d allowed_updates='["message"]'`.

Pendientes antes de producción: validar con `terraform validate` (no hay Terraform en la máquina donde se escribió), revisión de costos y la cuestión legal de transferencia internacional (ver `docs/legal`).
