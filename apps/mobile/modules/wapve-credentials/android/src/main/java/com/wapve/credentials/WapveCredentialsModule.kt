package com.wapve.credentials

import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException

import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WapveCredentialsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WapveCredentials")

    AsyncFunction("authenticatePasskey") Coroutine { requestJson: String ->
      val activity = appContext.currentActivity ?: throw CredentialActivityUnavailableException()
      val manager = CredentialManager.create(activity)
      val request = GetCredentialRequest(listOf(GetPublicKeyCredentialOption(requestJson)))
      val credential = try {
        manager.getCredential(activity, request).credential
      } catch (error: GetCredentialException) {
        val code = when (error) {
          is GetCredentialCancellationException -> "PASSKEY_CANCELLED"
          is NoCredentialException -> "PASSKEY_NO_CREDENTIAL"
          is GetCredentialInterruptedException -> "PASSKEY_INTERRUPTED"
          is GetCredentialProviderConfigurationException -> "PASSKEY_PROVIDER_UNAVAILABLE"
          is GetCredentialUnsupportedException -> "PASSKEY_UNSUPPORTED"
          else -> "PASSKEY_FAILED"
        }
        throw CodedException(code, "Credential Manager could not complete authentication", error)
      }
      if (credential !is PublicKeyCredential) throw UnsupportedCredentialException()
      credential.authenticationResponseJson
    }

    AsyncFunction("openProviderSettings") {
      val activity = appContext.currentActivity ?: throw CredentialActivityUnavailableException()
      if (Build.VERSION.SDK_INT >= 34) {
        CredentialManager.create(activity).createSettingsPendingIntent().send()
      } else {
        activity.startActivity(Intent(Settings.ACTION_SETTINGS))
      }
    }

    AsyncFunction("createPasskey") Coroutine { requestJson: String ->
      val activity = appContext.currentActivity ?: throw CredentialActivityUnavailableException()
      val manager = CredentialManager.create(activity)
      val response = manager.createCredential(activity, CreatePublicKeyCredentialRequest(requestJson))
      if (response !is CreatePublicKeyCredentialResponse) throw UnsupportedCredentialException()
      response.registrationResponseJson
    }
  }
}

private class CredentialActivityUnavailableException : CodedException("CREDENTIAL_ACTIVITY_UNAVAILABLE", "Credential Manager requires a foreground activity", null)
private class UnsupportedCredentialException : CodedException("UNSUPPORTED_CREDENTIAL", "Credential Manager returned an unsupported credential type", null)
