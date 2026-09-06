<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CodexAccountStatus, CodexCapabilities } from '@roon-screen-cover/shared';

const DEVICE_VERIFICATION_URL = 'https://auth.openai.com/codex/device';
const POLL_INTERVAL_MS = 2_000;
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const emit = defineEmits<{ capabilities: [value: CodexCapabilities] }>();

const capabilities = ref<CodexCapabilities | null>(null);
const accountStatus = ref<CodexAccountStatus | null>(null);
const message = ref<string | null>(null);
const busyAction = ref<'login' | 'cancel' | 'logout' | null>(null);
const codeCopied = ref(false);

let mounted = false;
let requestEpoch = 0;
let statusEpoch = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let statusController: AbortController | null = null;
let mutationController: AbortController | null = null;
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const enabled = computed(() => capabilities.value?.enabled === true);
const safeVerificationUrl = computed(() =>
  accountStatus.value?.login?.verificationUrl === DEVICE_VERIFICATION_URL
    ? DEVICE_VERIFICATION_URL
    : null,
);

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const candidate = payload as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string' && candidate.message) return candidate.message;
    if (typeof candidate.error === 'string' && candidate.error) return candidate.error;
  }
  return fallback;
}

function isAccountStatus(payload: unknown): payload is CodexAccountStatus {
  if (!payload || typeof payload !== 'object') return false;
  const state = (payload as { state?: unknown }).state;
  return state === 'unavailable' || state === 'signed-out' || state === 'signing-in' || state === 'signed-in';
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function stopStatusRequest(): void {
  statusEpoch += 1;
  statusController?.abort();
  statusController = null;
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  stopStatusRequest();
}

function clearCopiedState(): void {
  if (copiedTimer !== null) clearTimeout(copiedTimer);
  copiedTimer = null;
  codeCopied.value = false;
}

function resetRequests(): void {
  requestEpoch += 1;
  stopPolling();
  mutationController?.abort();
  mutationController = null;
  busyAction.value = null;
  clearCopiedState();
}

function applyStatus(status: CodexAccountStatus): void {
  accountStatus.value = status;
  message.value = status.error;
}

async function refreshStatus(): Promise<void> {
  if (!mounted || !props.active || !enabled.value || document.hidden || statusController || busyAction.value) return;

  const epoch = requestEpoch;
  const currentStatusEpoch = statusEpoch;
  const controller = new AbortController();
  statusController = controller;

  try {
    const response = await fetch('/api/codex/account', { signal: controller.signal });
    const payload = await responsePayload(response);
    if (!mounted || requestEpoch !== epoch || statusEpoch !== currentStatusEpoch) return;
    if (!response.ok && !isAccountStatus(payload)) {
      message.value = errorMessage(payload, `Could not check the account (HTTP ${response.status}).`);
      return;
    }
    if (isAccountStatus(payload)) applyStatus(payload);
    else message.value = 'The server returned an invalid account status.';
  } catch (error) {
    if (!controller.signal.aborted && mounted && requestEpoch === epoch && statusEpoch === currentStatusEpoch) {
      message.value = error instanceof Error ? error.message : 'Could not check the account.';
    }
  } finally {
    if (statusController === controller) statusController = null;
  }
}

function startPolling(immediate = true): void {
  stopPolling();
  if (!mounted || !props.active || !enabled.value || document.hidden) return;
  if (immediate) void refreshStatus();
  pollTimer = setInterval(() => { void refreshStatus(); }, POLL_INTERVAL_MS);
}

watch(() => props.active, active => { if (active) startPolling(); else stopPolling(); });

async function mutateAccount(
  action: 'login' | 'cancel' | 'logout',
  url: string,
  body: Record<string, never> | { loginId: string },
): Promise<void> {
  if (busyAction.value) return;

  requestEpoch += 1;
  const epoch = requestEpoch;
  stopStatusRequest();
  mutationController?.abort();
  const controller = new AbortController();
  mutationController = controller;
  busyAction.value = action;
  message.value = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await responsePayload(response);
    if (!mounted || requestEpoch !== epoch) return;
    if (!response.ok && !isAccountStatus(payload)) {
      message.value = errorMessage(payload, `The request failed (HTTP ${response.status}).`);
      return;
    }
    if (isAccountStatus(payload)) applyStatus(payload);
    else message.value = 'The server returned an invalid account status.';
  } catch (error) {
    if (!controller.signal.aborted && mounted && requestEpoch === epoch) {
      message.value = error instanceof Error ? error.message : 'The request failed.';
    }
  } finally {
    if (mutationController === controller) mutationController = null;
    if (mounted && requestEpoch === epoch) {
      busyAction.value = null;
      startPolling(false);
    }
  }
}

function beginLogin(): void {
  void mutateAccount('login', '/api/codex/login', {});
}

function cancelLogin(): void {
  const loginId = accountStatus.value?.login?.loginId;
  if (loginId) void mutateAccount('cancel', '/api/codex/login/cancel', { loginId });
}

function logout(): void {
  void mutateAccount('logout', '/api/codex/logout', {});
}

async function copyUserCode(): Promise<void> {
  const code = accountStatus.value?.login?.userCode;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    clearCopiedState();
    codeCopied.value = true;
    copiedTimer = setTimeout(clearCopiedState, 2_000);
  } catch {
    message.value = 'Could not copy the code. Select it and copy it manually.';
  }
}

function attemptDeadline(expiresAt: string): string {
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) ? expiresAt : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function onVisibilityChange(): void {
  if (document.hidden) stopPolling();
  else startPolling();
}

function onPageHide(): void {
  resetRequests();
}

function onPageShow(): void {
  startPolling();
}

onMounted(async () => {
  mounted = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  try {
    const response = await fetch('/api/codex/capabilities');
    const payload = await responsePayload(response);
    if (!mounted || !response.ok || !payload || typeof payload !== 'object') return;
    const candidate = payload as Partial<CodexCapabilities>;
    if (typeof candidate.enabled === 'boolean' && typeof candidate.generationEnabled === 'boolean') {
      capabilities.value = candidate as CodexCapabilities;
      emit('capabilities', capabilities.value);
      startPolling();
    }
  } catch {
    // Capability discovery is intentionally silent so existing installations are unaffected.
  }
});

onBeforeUnmount(() => {
  mounted = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
  resetRequests();
});
</script>

<template>
  <section v-if="enabled" class="codex-account-panel" aria-labelledby="codex-account-title">
    <header>
      <h2 id="codex-account-title">ChatGPT account</h2>
      <p>Connect an account with a code you approve on another device.</p>
    </header>

    <p class="availability-note">
      <template v-if="capabilities?.generationEnabled">Select ChatGPT (Codex) below to research music facts from web sources using this account. Research is cached and reused across tracks.</template>
      <template v-else>Account connection is ready. Using a ChatGPT subscription to generate facts is not available yet.</template>
    </p>

    <p v-if="message" role="alert" class="account-message">{{ message }}</p>

    <div class="account-controls">
      <div v-if="!accountStatus" role="status" class="status-row">Checking account status…</div>

      <div v-else-if="accountStatus.state === 'signed-out'" class="account-state">
        <p>No ChatGPT account is connected.</p>
        <button type="button" class="primary-button" :disabled="busyAction !== null" @click="beginLogin">
          {{ busyAction === 'login' ? 'Starting…' : 'Connect ChatGPT' }}
        </button>
      </div>

      <div v-else-if="accountStatus.state === 'signing-in' && accountStatus.login" class="account-state pending-state">
        <p class="waiting-label" role="status">Waiting for approval</p>
        <p>Open the verification page on a phone or laptop, then enter this code:</p>
        <div class="device-code-row">
          <code class="device-code">{{ accountStatus.login.userCode }}</code>
          <button type="button" class="secondary-button" :disabled="busyAction !== null" @click="copyUserCode">
            {{ codeCopied ? 'Copied' : 'Copy code' }}
          </button>
        </div>
        <a
          v-if="safeVerificationUrl"
          :href="safeVerificationUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="verification-link"
        >Open ChatGPT verification</a>
        <p v-else class="account-message" role="alert">The server returned an unrecognized verification address.</p>
        <p class="deadline">This attempt ends around {{ attemptDeadline(accountStatus.login.expiresAt) }}. The code may expire sooner.</p>
        <button type="button" class="secondary-button danger-button" :disabled="busyAction !== null" @click="cancelLogin">
          {{ busyAction === 'cancel' ? 'Cancelling…' : 'Cancel connection' }}
        </button>
      </div>

      <div v-else-if="accountStatus.state === 'signed-in'" class="account-state signed-in-state">
        <p class="connected-label">Connected</p>
        <dl v-if="accountStatus.account">
          <div v-if="accountStatus.account.email">
            <dt>Email</dt>
            <dd>{{ accountStatus.account.email }}</dd>
          </div>
          <div v-if="accountStatus.account.planType">
            <dt>Plan</dt>
            <dd>{{ accountStatus.account.planType }}</dd>
          </div>
        </dl>
        <button type="button" class="secondary-button danger-button" :disabled="busyAction !== null" @click="logout">
          {{ busyAction === 'logout' ? 'Signing out…' : 'Sign out' }}
        </button>
      </div>

      <div v-else class="account-state unavailable-state">
        <p>Account connection is temporarily unavailable.</p>
        <button type="button" class="secondary-button" :disabled="busyAction !== null" @click="refreshStatus">Try again</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.codex-account-panel {
  padding: 24px;
  border: 1px solid var(--border-subtle, #2b2b30);
  border-radius: var(--radius-lg, 12px);
  background: var(--bg-elevated, #111113);
  color: var(--text-primary, #f5f5f5);
}

header h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

header p,
.account-state p {
  margin: 0;
  color: var(--text-muted, #9ca3af);
  font-size: 13px;
  line-height: 1.5;
}

.availability-note {
  margin: 18px 0;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle, #2b2b30);
  border-radius: var(--radius-md, 8px);
  background: var(--bg-surface, #18181b);
  color: var(--text-secondary, #d1d5db);
  font-size: 13px;
}

.account-controls,
.account-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.primary-button,
.secondary-button {
  align-self: flex-start;
  padding: 9px 13px;
  border: 1px solid var(--border-default, #3f3f46);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-surface, #18181b);
  color: var(--text-secondary, #d1d5db);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  border-color: var(--accent-primary, #f59e0b);
  background: var(--accent-primary, #f59e0b);
  color: #111;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.account-message {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: var(--radius-md, 8px);
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  font-size: 13px;
}

.status-row {
  color: var(--text-muted, #9ca3af);
  font-size: 13px;
}

.device-code-row {
  justify-content: flex-start;
}

.device-code {
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  background: var(--bg-surface, #18181b);
  color: var(--text-primary, #f5f5f5);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.12em;
  user-select: all;
}

.verification-link {
  align-self: flex-start;
  color: var(--accent-primary, #f59e0b);
  font-size: 13px;
  font-weight: 600;
}

.waiting-label,
.connected-label {
  color: var(--accent-primary, #f59e0b) !important;
  font-weight: 700;
}

.signed-in-state dl {
  margin: 0;
}

.signed-in-state dl div {
  display: grid;
  grid-template-columns: 70px 1fr;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle, #2b2b30);
}

.signed-in-state dt {
  color: var(--text-muted, #9ca3af);
  font-size: 12px;
}

.signed-in-state dd {
  margin: 0;
  font-size: 13px;
}

.danger-button {
  color: #fca5a5;
}

.deadline {
  font-size: 12px !important;
}

@media (max-width: 520px) {
  .controls-heading,
  .device-code-row {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
