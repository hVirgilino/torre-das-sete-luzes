import { despachar } from '../_lib/despachar.js';
import submit from '../_rotas/ranking-submit.js';
import me from '../_rotas/ranking-me.js';

export default despachar({ submit, me });
