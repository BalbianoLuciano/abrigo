output "load_balancer_ip" {
  value       = google_compute_global_address.main.address
  description = "Apuntá los registros A de app_domain y api_domain acá."
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "web_bucket" {
  value = google_storage_bucket.web.name
}

output "kms_key" {
  value = google_kms_crypto_key.messages.id
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  value = google_service_account.deployer.email
}
