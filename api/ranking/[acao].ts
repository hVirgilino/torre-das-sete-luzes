import { despachar } from '../_lib/despachar';
import submit from '../_rotas/ranking-submit';
import me from '../_rotas/ranking-me';

export default despachar({ submit, me });
