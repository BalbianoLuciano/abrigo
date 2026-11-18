# Infraestructura (GCP) — escrita, todavía sin aplicar

1. Crear el proyecto y el bucket de estado: `gsutil mb -l southamerica-east1 gs://<proyecto>-tfstate`.
2. `cp terraform.tfvars.example terraform.tfvars` y completar.
3. `terraform init -backend-config="bucket=<proyecto>-tfstate"` y `terraform apply`.
   El primer apply necesita una imagen existente en `var.image` (subir una a mano o usar una pública temporal).
4. Cargar los secretos manuales:
   `MESSAGE_KEYS` (claves de datos envueltas con la clave KMS `messages`), `TURNSTILE_SECRET_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SMTP_URL`:
   `printf '%s' "$VALOR" | gcloud secrets versions add abrigo-<nombre> --data-file=-`.
5. Apuntar los registros A de los dominios a `load_balancer_ip`.
6. En GitHub (environment `production`), definir las variables `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOYER_SA`, `GCP_ARTIFACT_REGISTRY`, `GCP_WEB_BUCKET`, `PUBLIC_API_URL` y `TURNSTILE_SITE_KEY` con los outputs.

Pendientes antes de producción: validar con `terraform validate` (no hay Terraform en la máquina donde se escribió), revisión de costos y la cuestión legal de transferencia internacional (ver `docs/legal`).
