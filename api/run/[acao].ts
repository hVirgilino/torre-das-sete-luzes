import { despachar } from '../_lib/despachar.js';
import start from '../_rotas/run-start.js';
import question from '../_rotas/run-question.js';
import answer from '../_rotas/run-answer.js';
import ability from '../_rotas/run-ability.js';
import light from '../_rotas/run-light.js';
import finish from '../_rotas/run-finish.js';
import debug from '../_rotas/run-debug.js';

export default despachar({ start, question, answer, ability, light, finish, debug });
