// =====================================================================
// VAMMOCARRINHOS · Conector Headwind MDM — FASE 1 (validação)
// =====================================================================
// Objetivo desta fase: provar que o login no Headwind funciona e
// descobrir os nomes EXATOS dos campos (device number, último sync...).
//
// COMO USAR:
//   1. Abra o projeto Apps Script do app de carrinhos (o mesmo do v7).
//      Crie um arquivo novo (ex.: "hmdm.gs") e cole TUDO isto.
//   2. Configure as credenciais (uma vez):
//        Projeto → Configurações do projeto (engrenagem) →
//        Propriedades do script → Adicionar propriedade:
//           HMDM_URL       = https://77-42-123-143.nip.io
//           HMDM_LOGIN     = <seu usuário admin do Headwind>
//           HMDM_PASSWORD  = <sua senha admin do Headwind>
//      ⚠ NUNCA coloque a senha no código. Só nas Propriedades do script.
//   3. Selecione a função  hmdmDebugDumpDevice  e clique em Executar.
//   4. Autorize quando pedir. Depois abra "Execuções" / "Registros"
//      (Ver → Logs) e me mande o que apareceu.
// =====================================================================

function HMDM_CFG_() {
  var p = PropertiesService.getScriptProperties();
  return {
    url:      (p.getProperty('HMDM_URL') || '').replace(/\/+$/, ''),
    login:    p.getProperty('HMDM_LOGIN'),
    password: p.getProperty('HMDM_PASSWORD')
  };
}

// MD5 em hexadecimal (o Headwind espera o hash MD5 da senha, não a senha pura)
function hmdmMd5Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

// Loga no Headwind e devolve o token JWT (cobre token no header E no corpo)
function hmdmLogin_() {
  var cfg = HMDM_CFG_();
  if (!cfg.url || !cfg.login || !cfg.password) {
    throw new Error('Faltam Propriedades do script: HMDM_URL / HMDM_LOGIN / HMDM_PASSWORD');
  }
  var resp = UrlFetchApp.fetch(cfg.url + '/rest/public/jwt/login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ login: cfg.login, password: hmdmMd5Hex_(cfg.password) }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('Login Headwind falhou (HTTP ' + code + '): ' + resp.getContentText().slice(0, 300));
  }
  // 1) Token no header Authorization?
  var headers = resp.getAllHeaders() || {};
  var auth = headers['Authorization'] || headers['authorization'];
  if (auth) return String(auth).replace(/^Bearer\s+/i, '');
  // 2) Token no corpo JSON?
  var body = {};
  try { body = JSON.parse(resp.getContentText()); } catch (e) {}
  var tok = body.token || body.jwt || (body.data && (body.data.token || body.data.jwt));
  if (!tok) throw new Error('Login OK (200) mas não achei o token. Corpo: ' + resp.getContentText().slice(0, 400));
  return tok;
}

// Busca a lista de dispositivos
function hmdmSearchDevices_(token) {
  var cfg = HMDM_CFG_();
  var resp = UrlFetchApp.fetch(cfg.url + '/rest/private/devices/search', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ pageNum: 1, pageSize: 1000, value: '' }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('Busca de devices falhou (HTTP ' + code + '): ' + resp.getContentText().slice(0, 300));
  }
  var json = JSON.parse(resp.getContentText());
  var data = json.data || json;
  return data.devices || data.items || (Array.isArray(data) ? data : []);
}

// >>> RODE ESTA <<< — imprime o JSON cru de 1 device pra confirmarmos os campos
function hmdmDebugDumpDevice() {
  var token = hmdmLogin_();
  Logger.log('✅ Login OK. Token (início): ' + token.slice(0, 20) + '...');
  var list = hmdmSearchDevices_(token);
  Logger.log('Total de devices encontrados: ' + list.length);
  if (!list.length) { Logger.log('⚠ Nenhum device retornado — verifique o usuário/permissão.'); return; }
  Logger.log('--- Campos do 1º device (nomes das chaves): ---');
  Logger.log(Object.keys(list[0]).join(', '));
  Logger.log('--- JSON cru do 1º device: ---');
  Logger.log(JSON.stringify(list[0], null, 2));
}
