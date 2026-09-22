import { consume } from "@lit/context";
import { html } from "lit";
import { state } from "lit/decorators.js";
import { titleForRoute } from "../../app-navigation.ts";
import { applicationContext, type ApplicationContext } from "../../app/context.ts";
import { t } from "../../i18n/index.ts";
import { formatUiError } from "../../lib/format-error.ts";
import { OpenClawLightDomElement } from "../../lit/openclaw-element.ts";

type ModelPreset = {
  id: string;
  label: string;
  providerId: string;
  baseUrl: string;
  modelId: string;
};

const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    id: "bailian-qwen",
    label: "阿里云百炼 (DashScope) · Qwen",
    providerId: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen3.8-flash",
  },
  {
    id: "openai-compatible",
    label: "自定义 OpenAI 兼容端点",
    providerId: "custom",
    baseUrl: "",
    modelId: "",
  },
];

type SaveState = {
  phase: "idle" | "saving" | "saved" | "error";
  message: string | null;
};

type ConfigSnapshotLike = { hash?: string };

class ModelOnboardingPage extends OpenClawLightDomElement {
  @consume({ context: applicationContext, subscribe: true })
  private context!: ApplicationContext;

  @state() private providerId = "qwen";
  @state() private baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
  @state() private modelId = "qwen3.8-flash";
  @state() private apiKey = "";
  @state() private setAsDefault = true;
  @state() private save: SaveState = { phase: "idle", message: null };

  private applyPreset(presetId: string) {
    const preset = MODEL_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }
    this.providerId = preset.providerId;
    this.baseUrl = preset.baseUrl;
    this.modelId = preset.modelId;
    this.save = { phase: "idle", message: null };
  }

  private renderField(label: string, control: unknown) {
    return html`
      <label style="display:block;margin:0 0 14px;">
        <span style="display:block;font-size:12px;opacity:.75;margin-bottom:4px;">${label}</span>
        ${control}
      </label>
    `;
  }

  private readonly inputStyle =
    "width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;" +
    "border:1px solid var(--border-color, rgba(127,127,127,.35));" +
    "background:var(--input-background, transparent);color:inherit;font:inherit;";

  private async submit() {
    const snapshot = this.context?.gateway?.snapshot;
    const client = snapshot?.client ?? null;
    if (!client || snapshot?.phase !== "connected") {
      this.save = { phase: "error", message: t("modelOnboarding.notConnected") };
      return;
    }
    const providerId = this.providerId.trim();
    const baseUrl = this.baseUrl.trim();
    const modelId = this.modelId.trim();
    const apiKey = this.apiKey.trim();
    if (!providerId || !baseUrl || !modelId) {
      this.save = { phase: "error", message: t("modelOnboarding.fieldsRequired") };
      return;
    }
    this.save = { phase: "saving", message: null };
    try {
      const config = await client.request<ConfigSnapshotLike>("config.get", {});
      const baseHash = typeof config?.hash === "string" ? config.hash : "";
      if (!baseHash) {
        throw new Error(t("modelOnboarding.hashMissing"));
      }
      const provider: Record<string, unknown> = {
        baseUrl,
        models: [{ id: modelId, name: modelId }],
      };
      if (apiKey) {
        provider.apiKey = apiKey;
      }
      const patch: Record<string, unknown> = {
        models: { providers: { [providerId]: provider } },
      };
      if (this.setAsDefault) {
        patch.agents = { defaults: { model: { primary: `${providerId}/${modelId}` } } };
      }
      await client.request("config.patch", {
        baseHash,
        raw: JSON.stringify(patch),
        note: "Configure model endpoint from the Control UI",
        replacePaths: [`models.providers.${providerId}.models`],
      });
      this.apiKey = "";
      this.save = {
        phase: "saved",
        message: t("modelOnboarding.saved", { model: `${providerId}/${modelId}` }),
      };
    } catch (error) {
      this.save = { phase: "error", message: formatUiError(error) };
    }
  }

  override render() {
    const busy = this.save.phase === "saving";
    return html`
      <section class="content-header">
        <div>
          <div class="page-title">${titleForRoute("model-onboarding")}</div>
        </div>
      </section>
      <div style="max-width:640px;padding:0 24px 32px;">
        <p style="opacity:.8;margin:0 0 18px;">${t("modelOnboarding.intro")}</p>

        ${this.renderField(
          t("modelOnboarding.preset"),
          html`
            <select
              style=${this.inputStyle}
              @change=${(event: Event) =>
                this.applyPreset((event.target as HTMLSelectElement).value)}
            >
              ${MODEL_PRESETS.map(
                (preset) => html`<option value=${preset.id}>${preset.label}</option>`,
              )}
            </select>
          `,
        )}
        ${this.renderField(
          t("modelOnboarding.providerId"),
          html`
            <input
              style=${this.inputStyle}
              .value=${this.providerId}
              @input=${(event: Event) =>
                (this.providerId = (event.target as HTMLInputElement).value)}
            />
          `,
        )}
        ${this.renderField(
          t("modelOnboarding.baseUrl"),
          html`
            <input
              style=${this.inputStyle}
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              .value=${this.baseUrl}
              @input=${(event: Event) => (this.baseUrl = (event.target as HTMLInputElement).value)}
            />
          `,
        )}
        ${this.renderField(
          t("modelOnboarding.modelId"),
          html`
            <input
              style=${this.inputStyle}
              placeholder="qwen3.8-flash"
              .value=${this.modelId}
              @input=${(event: Event) => (this.modelId = (event.target as HTMLInputElement).value)}
            />
          `,
        )}
        ${this.renderField(
          t("modelOnboarding.apiKey"),
          html`
            <input
              type="password"
              style=${this.inputStyle}
              placeholder="sk-..."
              .value=${this.apiKey}
              @input=${(event: Event) => (this.apiKey = (event.target as HTMLInputElement).value)}
            />
          `,
        )}

        <label style="display:flex;align-items:center;gap:8px;margin:4px 0 18px;">
          <input
            type="checkbox"
            .checked=${this.setAsDefault}
            @change=${(event: Event) =>
              (this.setAsDefault = (event.target as HTMLInputElement).checked)}
          />
          <span>${t("modelOnboarding.setDefault")}</span>
        </label>

        <button
          style="padding:9px 18px;border-radius:8px;border:0;cursor:pointer;font:inherit;"
          ?disabled=${busy}
          @click=${() => void this.submit()}
        >
          ${busy ? t("modelOnboarding.saving") : t("modelOnboarding.save")}
        </button>

        ${
          this.save.message
            ? html`
                <p
                  style="margin:16px 0 0;color:${
                    this.save.phase === "error" ? "var(--danger-color, #d33)" : "inherit"
                  };"
                >
                  ${this.save.message}
                </p>
              `
            : ""
        }
      </div>
    `;
  }
}

if (!customElements.get("openclaw-model-onboarding-page")) {
  customElements.define("openclaw-model-onboarding-page", ModelOnboardingPage);
}
