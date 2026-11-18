variable "project_id" {
  type        = string
  description = "Proyecto de GCP."
}

variable "region" {
  type        = string
  default     = "southamerica-east1"
  description = "São Paulo: la región más cercana a Argentina (ver pendiente legal sobre transferencia de datos)."
}

variable "app_domain" {
  type        = string
  description = "Dominio de la PWA, por ejemplo abrigo.ar."
}

variable "api_domain" {
  type        = string
  description = "Dominio de la API, por ejemplo api.abrigo.ar (mismo sitio que la PWA, para las cookies)."
}

variable "image" {
  type        = string
  description = "Imagen de la API/worker en Artifact Registry (la publica CI)."
}

variable "db_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "redis_memory_gb" {
  type    = number
  default = 1
}

variable "email_from" {
  type    = string
  default = "Abrigo <avisos@abrigo.ar>"
}

variable "github_repository" {
  type        = string
  description = "owner/repo, para Workload Identity Federation desde GitHub Actions."
}
