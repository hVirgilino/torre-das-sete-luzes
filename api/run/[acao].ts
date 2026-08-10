import { despachar } from '../_lib/despachar';
import start from '../_rotas/run-start';
import question from '../_rotas/run-question';
import answer from '../_rotas/run-answer';
import ability from '../_rotas/run-ability';
import light from '../_rotas/run-light';
import finish from '../_rotas/run-finish';

export default despachar({ start, question, answer, ability, light, finish });
