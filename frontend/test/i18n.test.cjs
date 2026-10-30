const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Load the real TS helpers in Node without installing another test runtime.
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true },
  });
  module._compile(output.outputText, filename);
};
const storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
global.document = { documentElement: { lang: '' }, querySelector: () => null, title: '' };
const config = require('../src/i18n/config.ts');
const i18n = config.default;
const format = require('../src/utils/format.ts');
const errors = require('../src/i18n/errors.ts');
const { validationMessage } = require('../src/i18n/validation.ts');
const { bilingualText, categoryLabel } = require('../src/i18n/content.ts');
const { validSecurePassword } = require('../src/utils/registration.ts');

test('dynamic content switches immediately, preserves Spanish and ignores blank English', async () => {
  const category = { id: 'unchanged-id', name: 'Comida', code: 'food' };
  await i18n.changeLanguage('es');
  assert.equal(bilingualText('Comida rica y rápida al instante', 'Delicious fast food served instantly'), 'Comida rica y rápida al instante');
  assert.equal(categoryLabel(category), 'Comida');
  await i18n.changeLanguage('en');
  assert.equal(categoryLabel(category), 'Food');
  assert.equal(bilingualText('Corte de cabello', 'Haircut'), 'Haircut');
  for (const empty of [undefined, null, '', '   '])
    assert.equal(bilingualText('Contenido original', empty), 'Contenido original');
  assert.equal(categoryLabel({ name: 'Categoría personalizada', code: 'not-supported' }), 'Categoría personalizada');
  assert.equal(categoryLabel({ name: 'Categoría personalizada' }), 'Categoría personalizada');
  assert.equal(category.name, 'Comida');
  await i18n.changeLanguage('es');
  assert.equal(bilingualText('Corte de cabello', 'Haircut'), 'Corte de cabello');
});

test('default, selection persistence, unsupported preference and unavailable storage', async () => {
  assert.equal(i18n.resolvedLanguage, 'es');
  assert.equal(document.documentElement.lang, 'es');
  await i18n.changeLanguage('en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(config.initialLanguage(), 'en');
  assert.equal(storage.get(config.languageStorageKey), 'en');
  storage.set(config.languageStorageKey, 'fr');
  assert.equal(config.initialLanguage(), 'es');
  const existing = global.localStorage;
  global.localStorage = { getItem: () => { throw Error('Unavailable'); }, setItem: () => { throw Error('Unavailable'); } };
  assert.equal(config.initialLanguage(), 'es');
  await i18n.changeLanguage('es');
  global.localStorage = existing;
});
test('missing English entry falls back to Spanish and plurals interpolate', async () => {
  await i18n.changeLanguage('en');
  const english = i18n.getResourceBundle('en', 'common');
  const saved = english.loading;
  delete english.loading;
  try { assert.equal(i18n.t('common:loading'), 'Cargando…'); }
  finally { english.loading = saved; }
  assert.equal(i18n.t('catalog:results', { count: 1 }), '1 business found');
  assert.equal(i18n.t('catalog:results', { count: 2 }), '2 businesses found');
  assert.equal(i18n.t('auth:fields.passwordMinimum', { min: 12 }), 'At least 12 characters');
  assert.equal(i18n.t('validation:passwordRequirements'), 'Password must contain at least 12 characters, one uppercase letter, one lowercase letter, and one number.');
});
test('new passwords enforce the same length and composition policy in the frontend', () => {
  for (const value of ['a', 'Aa123456789', '123456', 'password', 'abcdefgh1234', ' '.repeat(12)])
    assert.equal(validSecurePassword(value), false, value);
  for (const value of ['Reserva2026Segura!', 'Aa1234567890', 'Aa1' + '!'.repeat(69)])
    assert.equal(validSecurePassword(value), true, value.length);
  assert.equal(validSecurePassword('Aa1' + '!'.repeat(70)), false);
});
test('both languages have the same nonempty keys and interpolation variables', () => {
  function flatten(obj, prefix = '') {
    return Object.fromEntries(Object.entries(obj).flatMap(([key, value]) => {
      const full = prefix + key;
      return typeof value === 'string' ? [[full, value]] : Object.entries(flatten(value, full + '.'));
    }));
  }
  for (const ns of i18n.options.ns) {
    const es = flatten(i18n.getResourceBundle('es', ns));
    const en = flatten(i18n.getResourceBundle('en', ns));
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), ns);
    for (const key of Object.keys(es)) {
      assert.ok(es[key].trim() && en[key].trim(), `${ns}:${key}`);
      assert.deepEqual((es[key].match(/{{[^}]+}}/g) ?? []).sort(), (en[key].match(/{{[^}]+}}/g) ?? []).sort(), `${ns}:${key}`);
    }
  }
});
test('known error codes, legacy messages and safe unknown-message fallback', async () => {
  await i18n.changeLanguage('en');
  assert.equal(errors.errorMessage(errors.errorKey('INVALID_CREDENTIALS', 'legacy')), 'Incorrect email or password.');
  assert.equal(errors.errorMessage('Correo o contraseña incorrectos.'), 'Incorrect email or password.');
  assert.equal(errors.errorMessage(errors.errorKey('FUTURE_CODE', 'Mensaje existente')), 'Mensaje existente');
  assert.equal(errors.errorMessage('validation:passwordMismatch'), 'The passwords do not match.');
  await i18n.changeLanguage('es');
  assert.equal(errors.errorMessage('errors:NETWORK_ERROR'), i18n.t('errors:NETWORK_ERROR'));
});
test('localized validation keeps original constraints', async () => {
  await i18n.changeLanguage('en');
  assert.equal(i18n.t('validation:characterLimit', { max: 100 }), 'Maximum 100 characters');
  assert.equal(validationMessage({ validity: { valueMissing: true } }), 'This field is required.');
  assert.equal(validationMessage({ validity: { typeMismatch: true }, type: 'email' }), 'Enter a valid email address.');
  assert.equal(validationMessage({ validity: { tooShort: true }, minLength: 10 }), 'Use at least 10 characters.');
  assert.equal(validationMessage({ validity: { tooLong: true }, maxLength: 72 }), 'Use no more than 72 characters.');
  await i18n.changeLanguage('es');
  assert.equal(i18n.t('validation:characterLimit', { max: 100 }), 'Máximo 100 caracteres');
});
test('date, time, numbers and CRC/USD formats use current locale without changing Costa Rica time', async () => {
  const instant = '2026-10-05T03:00:00Z';
  const stableDay = format.today();
  for (const lang of ['es', 'en']) {
    await i18n.changeLanguage(lang);
    const locale = lang === 'es' ? 'es-CR' : 'en-US';
    assert.equal(format.dateTime(instant), new Intl.DateTimeFormat(locale, { timeZone: 'America/Costa_Rica', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant)));
    assert.equal(format.time(instant), new Intl.DateTimeFormat(locale, { timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit' }).format(new Date(instant)));
    assert.equal(format.number(1234.5), new Intl.NumberFormat(locale).format(1234.5));
    for (const currency of ['CRC', 'USD']) assert.equal(format.money(1234.5, currency), new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'CRC' ? 0 : 2 }).format(1234.5));
    assert.equal(format.money(null), i18n.t('common:price.ask'));
    assert.equal(format.today(), stableDay);
    for (const status of ['PENDING', 'ACTIVE', 'INACTIVE', 'SUCCESS', 'FAILED', 'CONFIRMED', 'CANCELLED']) assert.ok(i18n.exists(`common:status.${status}`));
  }
});
test('API preserves status, message arrays, unknown errors and credentials', async () => {
  const { api, ApiError } = require('../src/services/api.ts');
  const originalFetch = global.fetch;
  try {
    global.fetch = async (_url, options) => {
      assert.equal(options.credentials, 'include');
      assert.equal(options.headers['X-Requested-With'], 'ReservaCR');
      return { ok: false, status: 401, json: async () => ({ code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' }) };
    };
    await assert.rejects(api('/auth/login'), err => err instanceof ApiError && err.status === 401 && err.message === 'errors:INVALID_CREDENTIALS');
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' }) });
    await assert.rejects(api('/auth/login'), err => err.status === 401 && err.message === 'errors:AUTH_INVALID_CREDENTIALS');
    await i18n.changeLanguage('en');
    assert.equal(errors.errorMessage('errors:AUTH_INVALID_CREDENTIALS'), 'Incorrect email or password.');
    await i18n.changeLanguage('es');
    assert.equal(errors.errorMessage('errors:AUTH_INVALID_CREDENTIALS'), 'Correo o contraseña incorrectos.');
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ message: ['Uno', 'Dos'] }) });
    await assert.rejects(api('/example'), err => err.message === 'Uno. Dos' && err.status === 400);
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ code: 'FUTURE_CODE', message: 'Existing message' }) });
    await assert.rejects(api('/example'), err => err.message === 'Existing message');
    global.fetch = async () => { throw Error('Network unavailable'); };
    await assert.rejects(api('/example'), err => err.message === 'errors:NETWORK_ERROR' && err.status === 0);
  } finally { global.fetch = originalFetch; }
});
test('phase 2 weekdays and plurals keep numeric domain values and current language', async () => {
  for (const language of ['es', 'en']) {
    await i18n.changeLanguage(language);
    const locale = language === 'es' ? 'es-CR' : 'en-US';
    for (let day = 0; day < 7; day++) {
      assert.equal(format.weekdayName(day), new Intl.DateTimeFormat(locale, {
        timeZone: 'America/Costa_Rica', weekday: 'long',
      }).format(new Date(Date.UTC(2023, 0, 1 + day, 12))));
    }
    assert.equal(format.minuteTime(480), '08:00');
    assert.equal(format.minuteTime(1440), '24:00');
  }
  assert.equal(i18n.t('business:capacity', { count: 1 }), '1 spot');
  assert.equal(i18n.t('business:capacity', { count: 2 }), '2 spots');
  assert.equal(i18n.t('admin:mail.attempts', { count: 1 }), '1 attempt');
  assert.equal(i18n.t('admin:mail.attempts', { count: 2 }), '2 attempts');
  await i18n.changeLanguage('es');
  assert.equal(i18n.t('business:capacity', { count: 1 }), '1 cupo');
  assert.equal(i18n.t('business:capacity', { count: 2 }), '2 cupos');
  assert.equal(errors.errorMessage('owner:errors.imageSize'), 'La imagen supera los 5 MB.');
  await i18n.changeLanguage('en');
  assert.equal(errors.errorMessage('owner:errors.imageSize'), 'The image exceeds 5 MB.');
  assert.equal(i18n.t('owner:notice.profile'), 'Profile saved.');
  assert.equal(i18n.t('bookings:detail.notes', { notes: 'Nota escrita por usuario' }), 'Note: Nota escrita por usuario');
});
test('phase 2 screens reference existing keys and contain no static visible prose', () => {
  const path = require('node:path');
  for (const screen of ['BusinessDetail', 'Bookings', 'Owner', 'Admin']) {
    const filename = path.join(__dirname, '../src/pages', screen + '.tsx');
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node)) assert.ok(!/[A-Za-záéíóúñ]/.test(node.text), `${screen}: untranslated JSX ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ['label', 'placeholder', 'aria-label', 'alt', 'title', 'eyebrow'].includes(node.name.text)) {
        assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), `${screen}: untranslated ${node.name.text}`);
      }
      if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        for (const lng of ['es', 'en']) assert.ok(i18n.exists(key, { lng, count: 1 }), `${screen}: ${lng} missing ${key}`);
      }
      if (ts.isStringLiteral(node) && /^(business|bookings|owner|admin):/.test(node.text)) {
        for (const lng of ['es', 'en']) assert.ok(i18n.exists(node.text, { lng, count: 1 }), `${screen}: ${lng} missing ${node.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test('password recovery submits the current resolved UI language and preserves reset payload', async () => {
  const path = require('node:path');
  const filename = path.join(__dirname, '../src/pages/PasswordRecovery.tsx');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const token = 'a'.repeat(64);
  const calls = [];
  const { send } = require('../src/services/api.ts');
  const react = require('react');
  const module = { exports: {} };
  const dependencies = {
    'react': { ...react, useState: value => [value, () => {}] },
    'react-i18next': { useTranslation: () => ({ t: i18n.t.bind(i18n), i18n }) },
    'react-router-dom': { Link: 'a', useSearchParams: () => [new URLSearchParams({ token })] },
    '../i18n/validation': { useLocalizedValidation: () => ({}) },
    '../components/UI': { ErrorBox: 'aside', Field: 'label' },
    '../utils/registration': { passwordPattern: '', validSecurePassword },
    '../services/api': { send, api: async (url, options) => calls.push({ url, body: JSON.parse(options.body) }) },
  };
  new Function('require', 'module', 'exports', output)(name => dependencies[name] ?? require(name), module, module.exports);
  function findForm(element) {
    if (!element || typeof element !== 'object') return;
    if (element.type === 'form') return element;
    for (const child of react.Children.toArray(element.props?.children)) {
      const found = findForm(child);
      if (found) return found;
    }
  }
  const originalFormData = global.FormData;
  global.FormData = class { constructor() { return new Map([['email', 'qa@example.test'], ['password', 'NewPassword123!'], ['confirm', 'NewPassword123!']]); } };
  try {
    // Render in ES, then switch before submit: the handler must use the active language.
    await i18n.changeLanguage('es');
    const form = findForm(module.exports.default({}));
    for (const [selected, expected] of [['en', 'en'], ['es', 'es'], ['en-US', 'en'], ['fr', 'es']]) {
      await i18n.changeLanguage(selected);
      await form.props.onSubmit({ preventDefault() {}, currentTarget: {} });
      assert.deepEqual(calls.at(-1), { url: '/auth/forgot-password', body: { email: 'qa@example.test', language: expected } });
    }
    await findForm(module.exports.default({ reset: true })).props.onSubmit({ preventDefault() {}, currentTarget: {} });
    assert.deepEqual(calls.at(-1), { url: '/auth/reset-password', body: { token, password: 'NewPassword123!' } });
  } finally { global.FormData = originalFormData; await i18n.changeLanguage('es'); }
});

test('booking creation and cancellation serialize the active resolved UI language', async () => {
  const path = require('node:path');
  const { api, send } = require('../src/services/api.ts');
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ code: 'CR-QA' }) };
  };
  function loadHandler(screen, matches, dependencies) {
    const filename = path.join(__dirname, '../src/pages', screen + '.tsx');
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler;
    function visit(node) {
      if (matches(node, source)) handler = node;
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(handler, `${screen}: real request handler must exist`);
    const output = ts.transpileModule(`module.exports = ${handler.getText(source)}`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    new Function('module', ...Object.keys(dependencies), output)(module, ...Object.values(dependencies));
    return module.exports;
  }
  const noop = () => {};
  const common = { api, send, i18n, setBusy: noop, setFailure: noop };
  const payload = { serviceId: 'service-id', slot: '2026-11-01T18:00:00Z', notes: 'Original notes', key: { current: 'unchanged-key' } };
  const create = loadHandler('BusinessDetail', (node, source) => ts.isArrowFunction(node) && node.getText(source).includes('send("POST"'),
    { ...common, ...payload, setSuccess: noop, availability: { reload: noop } });
  const cancel = loadHandler('Bookings', node => ts.isFunctionDeclaration(node) && node.name?.text === 'change',
    { ...common, reason: 'Original reason', setCancel: noop, setReason: noop, reload: noop });
  try {
    for (const [selected, expected] of [['en', 'en'], ['es', 'es'], ['en-US', 'en'], ['fr', 'es']]) {
      await i18n.changeLanguage(selected);
      await create();
      assert.deepEqual(calls.at(-1), { url: '/api/bookings', method: 'POST', body: {
        serviceId: payload.serviceId, startAt: payload.slot, notes: payload.notes, idempotencyKey: payload.key.current, language: expected,
      } });
      await cancel({ id: 'booking-id' }, 'CANCELLED');
      assert.deepEqual(calls.at(-1), { url: '/api/bookings/booking-id', method: 'PATCH', body: {
        status: 'CANCELLED', reason: 'Original reason', language: expected,
      } });
    }
    await cancel({ id: 'booking-id' }, 'COMPLETED');
    assert.deepEqual(calls.at(-1).body, { status: 'COMPLETED', reason: 'Original reason' });
  } finally { global.fetch = originalFetch; await i18n.changeLanguage('es'); }
});

test('phone and length errors translate from API fieldErrors in both languages', async () => {
  const { validBusinessPhone } = require('../src/utils/phone.ts');
  const { detectedPhoneRegion, filterNameInput, filterPhoneInput, validFullName, validRegistrationPhone } = require('../src/utils/registration.ts');
  for (const value of ['Erick Mora', 'María José Núñez', 'Jean-Pierre Mora']) assert.equal(validFullName(value), true, value);
  assert.equal(validFullName('454566565'), false);
  for (const value of ['87026279', '+50687026279', '18448724681', '1-844-872-4681']) assert.equal(validRegistrationPhone(value), true, value);
  for (const value of ['cderrtr55654', '123']) assert.equal(validRegistrationPhone(value), false, value);
  assert.deepEqual(detectedPhoneRegion('87026279'), { country: 'CR', callingCode: '506' });
  assert.deepEqual(detectedPhoneRegion('+50687026279'), { country: 'CR', callingCode: '506' });
  assert.equal(filterNameInput('Erick 123 Mora @@@'), 'Erick  Mora ');
  assert.equal(filterNameInput('454566565'), '');
  assert.equal(filterPhoneInput('cderrtr55654'), '55654');
  assert.equal(filterPhoneInput('abc'), '');
  assert.equal(filterPhoneInput('+506 8702-6279'), '+506 8702-6279');
  assert.deepEqual(detectedPhoneRegion('+1'), { country: 'US', callingCode: '1' });
  assert.deepEqual(detectedPhoneRegion('+14155552671'), { country: 'US', callingCode: '1' });
  assert.deepEqual(detectedPhoneRegion('18448724681'), { country: 'US', callingCode: '1' });
  assert.deepEqual(detectedPhoneRegion('1-844-872-4681'), { country: 'US', callingCode: '1' });
  assert.deepEqual(detectedPhoneRegion('+34'), { country: 'ES', callingCode: '34' });
  assert.deepEqual(detectedPhoneRegion('+52'), { country: 'MX', callingCode: '52' });
  assert.deepEqual(detectedPhoneRegion('+44'), { country: 'GB', callingCode: '44' });
  for (const value of ['87026279', '8702 6279', '8702-6279', '+506 8702 6279']) assert.equal(validBusinessPhone(value), true);
  for (const value of ['abc123', '123', '1'.repeat(26), '12345678', '00000000', '+1 2025550123', '87026279 ext 1']) assert.equal(validBusinessPhone(value), false);
  for (const [lang, phoneMessage] of [['es', 'Número de teléfono inválido.'], ['en', 'Invalid phone number.']]) {
    await i18n.changeLanguage(lang);
    assert.equal(errors.errorMessage(errors.errorKey('VALIDATION_ERROR', 'legacy', [{ field: 'phone', code: 'INVALID_PHONE' }])), phoneMessage);
    assert.equal(errors.errorMessage(errors.errorKey('VALIDATION_ERROR', 'legacy', [{ field: 'name', code: 'INVALID_FULL_NAME' }])), i18n.t('validation:invalidFullName'));
    assert.equal(errors.errorMessage(errors.errorKey('VALIDATION_ERROR', 'legacy', [{ field: 'name', code: 'MAX_LENGTH', max: 100 }])), i18n.t('validation:maxLength', {max: 100}));
  }
  await i18n.changeLanguage('es');
});
