# ─── PWA estática en Cloud Storage + un solo balanceador HTTPS para web y API ───
resource "google_storage_bucket" "web" {
  name                        = "${var.project_id}-abrigo-web"
  location                    = var.region
  uniform_bucket_level_access = true
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # SPA
  }
}

resource "google_storage_bucket_iam_member" "web_public" {
  bucket = google_storage_bucket.web.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "web" {
  name        = "abrigo-web"
  bucket_name = google_storage_bucket.web.name
  enable_cdn  = true
  # Cabeceras de seguridad para la PWA.
  custom_response_headers = [
    "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: no-referrer",
    "Permissions-Policy: camera=(), microphone=(), geolocation=(self)",
    "X-Frame-Options: DENY",
  ]
}

resource "google_compute_region_network_endpoint_group" "api" {
  name                  = "abrigo-api"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_security_policy" "api" {
  name = "abrigo-api"
  # Límite grueso por IP en el borde; los límites finos están en la API (Redis).
  rule {
    action   = "throttle"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 600
        interval_sec = 60
      }
    }
  }
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

resource "google_compute_backend_service" "api" {
  name                  = "abrigo-api"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.api.id
  timeout_sec           = 3600
  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }
  log_config {
    enable      = true
    sample_rate = 0.1
  }
}

resource "google_compute_url_map" "main" {
  name            = "abrigo"
  default_service = google_compute_backend_bucket.web.id
  host_rule {
    hosts        = [var.api_domain]
    path_matcher = "api"
  }
  path_matcher {
    name            = "api"
    default_service = google_compute_backend_service.api.id
  }
}

resource "google_compute_managed_ssl_certificate" "main" {
  name = "abrigo"
  managed {
    domains = [var.app_domain, var.api_domain]
  }
}

resource "google_compute_target_https_proxy" "main" {
  name             = "abrigo"
  url_map          = google_compute_url_map.main.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]
}

resource "google_compute_global_address" "main" {
  name = "abrigo"
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "abrigo-https"
  target                = google_compute_target_https_proxy.main.id
  port_range            = "443"
  ip_address            = google_compute_global_address.main.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_url_map" "redirect" {
  name = "abrigo-redirect"
  default_url_redirect {
    https_redirect = true
    strip_query    = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "abrigo-redirect"
  url_map = google_compute_url_map.redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "abrigo-http"
  target                = google_compute_target_http_proxy.redirect.id
  port_range            = "80"
  ip_address            = google_compute_global_address.main.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
