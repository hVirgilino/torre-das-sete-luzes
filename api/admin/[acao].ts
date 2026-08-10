import { despachar } from '../_lib/despachar';
import login from '../_rotas/admin-login';
import entries from '../_rotas/admin-entries';
import moderate from '../_rotas/admin-moderate';

export default despachar({ login, entries, moderate });
