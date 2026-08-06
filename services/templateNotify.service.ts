import { NotificationTemplateService } from "./notificationTemplate.service"; // your service
 import { renderDataMap, renderString } from "../helpers/templateRender";

type AdminNotification = {
  title: string;
  body: string;
  imageUrl?: string;
  // keep optional extras if your sender accepts them:
  clickAction?: string;
  data?: Record<string, string>;
  ttlSeconds?: number;
  androidChannelId?: string;
};

type Overrides = Partial<AdminNotification>;

export class TemplateNotifyService {
  private templates = new NotificationTemplateService();

  /**
   * Load a template by type, render with vars, then apply overrides.
   */
  async buildFromTemplate(templateType: string, vars: Record<string, any> = {}, overrides: Overrides = {}): Promise<AdminNotification> {
    const tpl: any = await this.templates.getTemplateByType(templateType);
    if (!tpl) throw new Error(`Notification template not found: ${templateType}`);

    // Expecting your template doc to have fields like: title, body, imageUrl?, clickAction?, data?
    const rendered: AdminNotification = {
      title:   renderString(overrides.title   ?? tpl.title,   vars) ?? "",
      body:    renderString(overrides.body    ?? tpl.body,    vars) ?? "",
      imageUrl:         renderString(overrides.imageUrl ?? tpl.imageUrl, vars),
      clickAction:      renderString(overrides.clickAction ?? tpl.clickAction, vars),
      data:             renderDataMap(overrides.data ?? tpl.data, vars),
      // ttlSeconds/androidChannelId: not typically in template; pass at send time if needed
    };

    return rendered;
  }

   async buildFromType(
    type: string,
    vars: Record<string, unknown> = {},
    overrides: Overrides = {}
  ): Promise<AdminNotification> {
    const tpl: any = await this.templates.getTemplateByType(type);
    if (!tpl) throw new Error(`Notification template not found: ${type}`);

    const title = renderString(overrides.title ?? tpl.title, vars) ?? "";
    const body = renderString(overrides.body ?? tpl.body, vars) ?? "";
    const imageUrl = renderString(overrides.imageUrl ?? tpl.imageUrl, vars);

    // note: clickAction/data not in your schema; only apply if overridden
    const out: AdminNotification = { title, body };
    if (imageUrl) out.imageUrl = imageUrl;
    if (overrides.clickAction) out.clickAction = overrides.clickAction;
    if (overrides.data) {
      // ensure string values for FCM data
      out.data = Object.fromEntries(
        Object.entries(overrides.data).map(([k, v]) => [k, String(v ?? "")])
      );
    }
    if (overrides.ttlSeconds) out.ttlSeconds = overrides.ttlSeconds;
    if (overrides.androidChannelId) out.androidChannelId = overrides.androidChannelId;

    return out;
  }
}
