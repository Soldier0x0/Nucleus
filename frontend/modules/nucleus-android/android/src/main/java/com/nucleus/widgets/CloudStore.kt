package com.nucleus.widgets

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

internal const val DRIVE_FILE_ID = "cloud_drive_file_id"

internal data class UploadResult(val ok: Boolean, val code: Int, val body: String)

internal fun uploadLockedBytes(context: Context, provider: String, token: String, bytes: ByteArray): UploadResult {
  return try {
    if (provider == "onedrive") putOneDrive(token, bytes) else putDrive(context, token, bytes)
  } catch (_: Exception) {
    UploadResult(false, 0, "")
  }
}

private fun putOneDrive(token: String, bytes: ByteArray): UploadResult {
  return request(
    "https://graph.microsoft.com/v1.0/me/drive/special/approot:/nucleus-locked.json:/content",
    "PUT",
    token,
    "application/json",
    bytes,
  )
}

private fun putDrive(context: Context, token: String, bytes: ByteArray): UploadResult {
  val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  val existing = safeDriveId(prefs.getString(DRIVE_FILE_ID, null))
  if (existing != null) {
    val patched = try {
      request(
        "https://www.googleapis.com/upload/drive/v3/files/$existing?uploadType=media",
        "PATCH",
        token,
        "application/json",
        bytes,
      )
    } catch (_: Exception) {
      UploadResult(false, 0, "")
    }
    if (patched.ok) return patched
    if (patched.code != 404 && patched.code != 0) return patched
    prefs.edit().remove(DRIVE_FILE_ID).apply()
  }
  val created = request(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    "POST",
    token,
    "multipart/related; boundary=nucleusBoundary7f3a",
    driveMultipart(bytes),
  )
  if (!created.ok) return created
  val id = try {
    safeDriveId(JSONObject(created.body).optString("id"))
  } catch (_: Exception) {
    null
  }
  if (id != null) prefs.edit().putString(DRIVE_FILE_ID, id).apply()
  return UploadResult(true, created.code, "")
}

private fun request(url: String, method: String, token: String, contentType: String, body: ByteArray): UploadResult {
  val conn = URL(url).openConnection() as HttpURLConnection
  try {
    conn.requestMethod = method
    conn.connectTimeout = 30_000
    conn.readTimeout = 30_000
    conn.doInput = true
    conn.doOutput = true
    conn.setRequestProperty("Authorization", "Bearer $token")
    conn.setRequestProperty("Content-Type", contentType)
    conn.outputStream.use { stream -> stream.write(body) }
    val code = conn.responseCode
    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
    val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
    return UploadResult(code in 200..299, code, text)
  } finally {
    conn.disconnect()
  }
}

private fun safeDriveId(id: String?): String? {
  if (id.isNullOrBlank()) return null
  if (!id.matches(Regex("^[A-Za-z0-9_-]{1,128}$"))) return null
  return id
}

private fun driveMultipart(bytes: ByteArray): ByteArray {
  val head = "--nucleusBoundary7f3a\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{\"name\":\"nucleus-locked.json\"}\r\n--nucleusBoundary7f3a\r\nContent-Type: application/json\r\n\r\n"
  val tail = "\r\n--nucleusBoundary7f3a--\r\n"
  return head.toByteArray(Charsets.UTF_8) + bytes + tail.toByteArray(Charsets.UTF_8)
}
