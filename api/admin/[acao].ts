import { despachar } from '../_lib/despachar.js';
import login from '../_rotas/admin-login.js';
import entries from '../_rotas/admin-entries.js';
import moderate from '../_rotas/admin-moderate.js';

export default despachar({ login, entries, moderate });
