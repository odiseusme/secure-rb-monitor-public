function isWeakDemo(pass) {
  return /^(TestPassphrase123!|password|Passw0rd|123456|qwerty)$/i.test(pass);
}

function classesCount(pass) {
  const tests = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
  return tests.reduce((n, re) => n + (re.test(pass) ? 1 : 0), 0);
}

function validateOrThrow(pass) {
  if (!pass) throw new Error("DASH_PASSPHRASE missing: export it before starting the uploader");

  if (isWeakDemo(pass)) {
    throw new Error("DASH_PASSPHRASE rejected: known weak/demo value");
  }

  const lenOK = pass.length >= 12;
  const wordsOK = pass.split(/[\s-]+/).filter(Boolean).length >= 3;
  const classOK = classesCount(pass) >= 3;

  if (!((lenOK || wordsOK) && classOK)) {
    throw new Error("DASH_PASSPHRASE too weak: require ≥12 chars or ≥3 words AND ≥3 of 4 classes (lower/upper/digit/symbol)");
  }
}

module.exports.ensure = function ensure() {
  try {
    validateOrThrow(process.env.DASH_PASSPHRASE || "");
  } catch (e) {
    console.error("[ERROR]", e.message);
    process.exit(3);
  }
};
