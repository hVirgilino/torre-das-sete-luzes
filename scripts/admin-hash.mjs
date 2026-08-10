// Gera o valor de ADMIN_PASSWORD_HASH a partir de uma senha.
//
//   npm run admin:hash -- "sua senha aqui"
//
// A senha em si nunca é guardada em lugar nenhum: o que vai para a variável de
// ambiente é o scrypt dela com sal aleatório. Nem eu nem o banco conseguem
// recuperar a senha a partir daí.
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

const senha = process.argv.slice(2).join(' ');
if (!senha) {
  console.error('uso: npm run admin:hash -- "sua senha"');
  process.exit(1);
}
if (senha.length < 12) {
  console.error('use pelo menos 12 caracteres — esta senha é a única porta do painel.');
  process.exit(1);
}

const sal = randomBytes(16);
const hash = await scrypt(senha.normalize('NFKC'), sal, 64);

console.log('\nCole no .env.local e nas Environment Variables da Vercel:\n');
console.log(`ADMIN_PASSWORD_HASH=scrypt$${sal.toString('base64url')}$${hash.toString('base64url')}\n`);
