# Secretos. Los generables los crea Terraform; los externos se cargan a mano
# (gcloud secrets versions add) — ver README.
resource "random_password" "auth_secret" {
  length  = 64
  special = false
}

locals {
  generated_secrets = {
    DATABASE_URL       = "postgres://${google_sql_user.app.name}:${random_password.db.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.abrigo.name}?sslmode=require"
    REDIS_URL          = "rediss://:${google_redis_instance.main.auth_string}@${google_redis_instance.main.host}:${google_redis_instance.main.port}"
    REDIS_CA_CERT      = google_redis_instance.main.server_ca_certs[0].cert
    BETTER_AUTH_SECRET = random_password.auth_secret.result
  }
  # Valores que provee el equipo: claves envueltas por KMS, Turnstile, VAPID, SMTP.
  manual_secrets = ["MESSAGE_KEYS", "TURNSTILE_SECRET_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "SMTP_URL"]
  all_secrets    = concat(keys(local.generated_secrets), local.manual_secrets)
}

resource "google_secret_manager_secret" "s" {
  for_each  = toset(local.all_secrets)
  secret_id = "abrigo-${lower(replace(each.value, "_", "-"))}"
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "generated" {
  for_each    = local.generated_secrets
  secret      = google_secret_manager_secret.s[each.key].id
  secret_data = each.value
}
