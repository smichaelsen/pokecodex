export function createAppRegistry() {
  const apps = new Map();
  let currentApp = null;
  let defaultApp = null;

  const registerApp = (id, factory) => {
    apps.set(id, factory);
  };

  const setDefaultApp = (id, ctx) => {
    defaultApp = { id, ctx };
  };

  const switchTo = async (id, ctx) => {
    if (currentApp?.destroy) currentApp.destroy();
    const factory = apps.get(id);
    if (!factory) throw new Error(`Unknown app: ${id}`);
    currentApp = await factory(ctx);
  };

  const start = (id, ctx) => switchTo(id, ctx);

  const startDefault = () => {
    if (!defaultApp) return Promise.resolve();
    return switchTo(defaultApp.id, defaultApp.ctx);
  };

  const destroy = () => {
    if (currentApp?.destroy) currentApp.destroy();
    currentApp = null;
  };

  return {
    registerApp,
    setDefaultApp,
    switchTo,
    start,
    startDefault,
    destroy,
  };
}
