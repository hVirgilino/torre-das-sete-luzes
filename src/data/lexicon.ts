/**
 * Vocabulário de apoio ao sorteio de questões — módulo puro, sem `window`,
 * porque as functions da API também o carregam (ver `data/difficulty.ts`).
 *
 * O que mora aqui é o que faz o modo Cavaleiro doer: um mapa de **trocas
 * próximas**, palavra por palavra, para gerar alternativas que diferem da
 * resposta certa por um detalhe só. Distrator vindo de outro trecho da
 * Cerimônia é fácil de descartar por assunto ou por ritmo da frase; trocar
 * "reverência" por "veneração" obriga a lembrar a palavra exata.
 *
 * Regras que as listas seguem — quebrá-las devolve alternativas denunciáveis:
 *
 * - **mesmo gênero e número da chave**: "sagrada" só recebe femininos, senão a
 *   concordância com o artigo vizinho entrega a troca;
 * - **plausível na boca do Mestre Conselheiro**: sinônimo, quase-sinônimo ou
 *   termo do mesmo campo (virtude, luz, pátria), nunca palavra fora de tom;
 * - **sem sinônimo perfeito**: se as duas formas fossem intercambiáveis, a
 *   questão viraria injusta. O que se cobra é a memória do texto oficial, e a
 *   troca precisa estar textualmente errada.
 */

/**
 * Palavras sem peso semântico — não viram lacuna nem alvo de troca automática.
 *
 * Estar aqui **não** tira a palavra do jogo: quem tem entrada em
 * `TROCAS_PROXIMAS` continua podendo ser trocada, porque ali a substituição foi
 * escolhida a mão. O que a lista impede é o mutador genérico encostar em
 * artigo, preposição e possessivo — foi assim que saiu "Ordem DeMolay vela
 * primeira vez" no lugar de "pela primeira vez".
 */
export const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'um', 'uma', 'que', 'não',
  'nos', 'nas', 'no', 'na', 'os', 'as', 'se', 'por', 'para', 'com', 'como', 'mais',
  'mas', 'ao', 'aos', 'à', 'às', 'já', 'é', 'são', 'ser', 'seu', 'sua', 'seus',
  'suas', 'nós', 'ele', 'ela', 'este', 'esta', 'esse', 'essa', 'aquele', 'aquela',
  'qual', 'quando', 'onde', 'então', 'porém', 'pois', 'sobre', 'até', 'sem', 'nem',
  // contrações e determinantes: mexer neles nunca dá pegadinha, só erro de português
  'pela', 'pelo', 'pelas', 'pelos', 'neste', 'nesta', 'deste', 'desta', 'desse',
  'dessa', 'isto', 'isso', 'aquilo', 'tão', 'ante', 'após', 'sob', 'desde',
  'muito', 'muita', 'muitos', 'muitas', 'todo', 'toda', 'todos', 'todas', 'tudo',
  'outro', 'outra', 'outros', 'outras', 'ainda', 'também', 'apenas',
  'estes', 'estas', 'esses', 'essas', 'aqueles', 'aquelas',
  // conectivos: inverter advérbio com substantivo dá frase torta, não pegadinha
  'então', 'talvez', 'conforme', 'enquanto', 'porque', 'contudo', 'assim',
  'sempre', 'nunca', 'jamais', 'somente',
  'nosso', 'nossa', 'nossos', 'nossas', 'vosso', 'vossa', 'vossos', 'vossas'
]);

/**
 * Trocas próximas por palavra, indexadas pela forma exata que aparece na
 * Cerimônia (minúscula, com acento). A chave é a palavra do texto oficial; os
 * valores são o que ela *quase* poderia ser.
 */
export const TROCAS_PROXIMAS: Record<string, string[]> = {
  // ------------------------------------------------------------- ordinais
  // As velas têm ordem canônica, e trocar o ordinal é a pegadinha mais limpa
  // que existe: a frase continua perfeita, só que na vela errada.
  primeira: ['segunda', 'terceira', 'última'],
  segunda: ['terceira', 'primeira', 'quarta'],
  terceira: ['quarta', 'segunda', 'quinta'],
  quarta: ['quinta', 'terceira', 'sexta'],
  quinta: ['sexta', 'quarta', 'sétima'],
  sexta: ['sétima', 'quinta', 'última'],
  sétima: ['sexta', 'última', 'primeira'],
  última: ['sétima', 'primeira', 'derradeira'],
  sete: ['três', 'cinco', 'nove'],
  centro: ['meio', 'coração', 'eixo'],

  // ---------------------------------------------------------- abertura
  diante: ['perante', 'defronte', 'adiante'],
  sagrado: ['sacro', 'bendito', 'santo'],
  sagrada: ['sacra', 'bendita', 'santa'],
  sagradas: ['sacras', 'benditas', 'santas'],
  altar: ['templo', 'santuário', 'oratório'],
  colocado: ['depositado', 'erguido', 'assentado'],
  poderosos: ['sólidos', 'gloriosos', 'inabaláveis'],
  baluartes: ['pilares', 'alicerces', 'fundamentos'],
  fé: ['crença', 'esperança', 'devoção'],
  livros: ['volumes', 'tomos', 'compêndios'],
  escolares: ['sagrados', 'divinos', 'antigos'],
  distante: ['adiante', 'afastado', 'oculto'],
  descansa: ['repousa', 'aguarda', 'tremula'],
  bandeira: ['pátria', 'nação', 'insígnia'],
  querida: ['amada', 'gloriosa', 'bendita'],
  pátria: ['nação', 'terra', 'bandeira'],
  sentinelas: ['guardiãs', 'vigias', 'atalaias'],
  velas: ['luzes', 'chamas', 'tochas'],
  acesas: ['ardentes', 'vivas', 'incandescentes'],
  faróis: ['archotes', 'tochas', 'guias'],
  escuridão: ['treva', 'noite', 'sombra'],
  luzes: ['chamas', 'estrelas', 'clarões'],
  iluminar: ['alumiar', 'clarear', 'guiar'],
  caminhos: ['passos', 'destinos', 'rumos'],
  viajamos: ['caminhamos', 'seguimos', 'avançamos'],
  adiante: ['avante', 'além', 'sempre'],
  estrada: ['jornada', 'senda', 'trilha'],
  símbolos: ['emblemas', 'sinais', 'retratos'],
  correto: ['justo', 'nobre', 'digno'],
  mundo: ['universo', 'século', 'orbe'],
  modelos: ['exemplos', 'padrões', 'alicerces'],
  prometemos: ['juramos', 'decidimos', 'firmamos'],
  basear: ['firmar', 'fundar', 'erguer'],
  vidas: ['almas', 'obras', 'jornadas'],

  // ------------------------------------------------------------- vela 1
  simboliza: ['representa', 'significa', 'evoca'],
  representa: ['simboliza', 'encarna', 'exprime'],
  amor: ['afeto', 'zelo', 'carinho'],
  pais: ['irmãos', 'antepassados', 'mestres'],
  filhos: ['irmãos', 'descendentes', 'herdeiros'],
  existia: ['vivia', 'habitava', 'ardia'],
  nascermos: ['existirmos', 'vivermos', 'despertarmos'],
  permanece: ['caminha', 'segue', 'arde'],
  conosco: ['convosco', 'consigo', 'presente'],
  durante: ['por', 'após', 'em'],
  seguirá: ['acompanhará', 'guiará', 'sustentará'],
  túmulo: ['sepulcro', 'jazigo', 'sono'],
  sábios: ['antigos', 'anciãos', 'mestres'],
  chamavam: ['nomeavam', 'diziam', 'tinham'],
  ágape: ['eros', 'filia', 'caritas'],
  razão: ['causa', 'finalidade', 'justificativa'],
  existir: ['viver', 'permanecer', 'durar'],

  // ------------------------------------------------------------- vela 2
  emblema: ['símbolo', 'sinal', 'retrato'],
  reverência: ['veneração', 'obediência', 'devoção'],
  jovem: ['moço', 'noviço', 'iniciado'],
  atravessando: ['cruzando', 'transpondo', 'ultrapassando'],
  limiar: ['umbral', 'pórtico', 'átrio'],
  ordem: ['fraternidade', 'irmandade', 'instituição'],
  professa: ['declara', 'proclama', 'jura'],
  profunda: ['firme', 'sincera', 'íntima'],
  permanente: ['duradoura', 'constante', 'eterna'],
  vivo: ['justo', 'eterno', 'onipotente'],
  verdadeiro: ['único', 'eterno', 'justo'],
  inabalável: ['indestrutível', 'inquebrantável', 'imutável'],
  graça: ['bênção', 'misericórdia', 'proteção'],
  celestial: ['divino', 'eterno', 'supremo'],
  trabalhos: ['esforços', 'labores', 'ofícios'],
  vão: ['nada', 'ruínas', 'pó'],

  // ------------------------------------------------------------- vela 3
  cortesia: ['cordialidade', 'gentileza', 'civilidade'],
  transcende: ['ultrapassa', 'excede', 'supera'],
  amizades: ['afinidades', 'fraternidades', 'simpatias'],
  alcança: ['abraça', 'atinge', 'acolhe'],
  desconhecidos: ['estranhos', 'forasteiros', 'estrangeiros'],
  velhos: ['sábios', 'anciãos', 'antigos'],
  homens: ['irmãos', 'cidadãos', 'semelhantes'],
  sentimento: ['calor', 'afeto', 'conforto'],
  caloroso: ['fraterno', 'acolhedor', 'afetuoso'],
  sorriso: ['gesto', 'aceno', 'olhar'],
  agradável: ['suportável', 'amena', 'ditosa'],
  próximo: ['semelhante', 'irmão', 'outro'],
  ilumina: ['alumia', 'clareia', 'aquece'],

  // ------------------------------------------------------------- vela 4
  companheirismo: ['convívio', 'congraçamento', 'entrosamento'],
  simbolicamente: ['justamente', 'igualmente', 'exatamente'],
  milhões: ['milhares', 'centenas', 'legiões'],
  ajoelharam: ['curvaram', 'prostraram', 'reuniram'],
  simbólico: ['sagrado', 'eterno', 'comum'],
  dedicaram: ['consagraram', 'entregaram', 'votaram'],
  elevados: ['nobres', 'sublimes', 'dignos'],
  princípios: ['preceitos', 'valores', 'ensinamentos'],
  filiação: ['conduta', 'formação', 'criação'],
  cidadania: ['filiação', 'conduta', 'fraternidade'],
  permanecermos: ['continuarmos', 'formos', 'estivermos'],
  fiéis: ['leais', 'firmes', 'presos'],
  promessas: ['juras', 'palavras', 'crenças'],

  // ------------------------------------------------------------- vela 5
  fidelidade: ['lealdade', 'constância', 'firmeza'],
  simplesmente: ['unicamente', 'somente', 'justamente'],
  nunca: ['jamais', 'sequer', 'porventura'],
  motivo: ['pretexto', 'razão', 'juízo'],
  justificado: ['justo', 'confessável', 'legítimo'],
  falso: ['infiel', 'desleal', 'traidor'],
  votos: ['juramentos', 'princípios', 'deveres'],
  amigos: ['irmãos', 'companheiros', 'próximos'],
  chamado: ['convocado', 'conclamado', 'obrigado'],
  diariamente: ['constantemente', 'incessantemente', 'continuamente'],
  defender: ['guardar', 'sustentar', 'honrar'],
  preceitos: ['princípios', 'ensinamentos', 'mandamentos'],
  jamais: ['nunca', 'sequer', 'porventura'],
  falhe: ['vacile', 'fraqueje', 'tropece'],
  líder: ['chefe', 'guia', 'exemplo'],
  homem: ['cidadão', 'filho', 'irmão'],

  // ------------------------------------------------------------- vela 6
  símbolo: ['emblema', 'sinal', 'retrato'],
  pureza: ['retidão', 'inocência', 'castidade'],
  corpo: ['gesto', 'hábito', 'semblante'],
  praticamos: ['guardamos', 'observamos', 'defendemos'],
  pensamento: ['sentimento', 'juízo', 'desejo'],
  palavra: ['voz', 'promessa', 'fala'],
  ação: ['obra', 'atitude', 'conduta'],
  puro: ['íntegro', 'justo', 'limpo'],
  digno: ['fiel', 'legítimo', 'justo'],
  representante: ['portador', 'herdeiro', 'guardião'],
  ensinamentos: ['preceitos', 'princípios', 'exemplos'],

  // ------------------------------------------------------------- vela 7
  patriotismo: ['civismo', 'nacionalismo', 'heroísmo'],
  talvez: ['quiçá', 'porventura', 'possivelmente'],
  chamados: ['convocados', 'conclamados', 'obrigados'],
  campo: ['teatro', 'terreno', 'palco'],
  batalha: ['guerra', 'combate', 'luta'],
  apresenta: ['oferece', 'reserva', 'concede'],
  oportunidades: ['ocasiões', 'ocorrências', 'chances'],
  firmarmos: ['afirmarmos', 'provarmos', 'revelarmos'],
  bons: ['nobres', 'dignos', 'justos'],
  corretos: ['justos', 'retos', 'exemplares'],
  cidadãos: ['homens', 'filhos', 'servidores'],
  serviço: ['defesa', 'honra', 'guarda'],
  reverenciada: ['venerada', 'amada', 'gloriosa'],

  // -------------------------------------------------------- encerramento
  vivemos: ['caminhamos', 'estamos', 'nascemos'],
  época: ['era', 'hora', 'idade'],
  turbulenta: ['conturbada', 'sombria', 'incerta'],
  nacional: ['sagrada', 'querida', 'amada'],
  correm: ['ameaçam', 'estão', 'podem'],
  risco: ['perigo', 'revés', 'temor'],
  afundar: ['submergir', 'desmoronar', 'perder-se'],
  ruínas: ['sombras', 'cinzas', 'trevas'],
  dúvida: ['descrença', 'hesitação', 'incerteza'],
  incerteza: ['indiferença', 'insegurança', 'dúvida'],
  gloriosos: ['sagrados', 'luminosos', 'nobres'],
  cobiçados: ['desejados', 'buscados', 'seguidos'],
  confiança: ['lealdade', 'honestidade', 'fé'],
  justiça: ['retidão', 'verdade', 'equidade'],
  fraternidade: ['amizade', 'irmandade', 'união'],
  consideradas: ['tidas', 'julgadas', 'reconhecidas'],
  virtuosas: ['nobres', 'elevadas', 'dignas'],
  qualidades: ['virtudes', 'verdades', 'condições'],
  inabaláveis: ['firmes', 'constantes', 'intransigentes'],
  procurarmos: ['buscarmos', 'tentarmos', 'soubermos'],
  diárias: ['cotidianas', 'comuns', 'constantes'],
  chamas: ['luzes', 'velas', 'tochas'],
  apagarão: ['extinguirão', 'silenciarão', 'findarão'],
  silenciadas: ['perdidas', 'sepultadas', 'encobertas'],
  sombras: ['trevas', 'cinzas', 'névoas'],
  país: ['mundo', 'povo', 'lar'],
  carrega: ['guarda', 'traz', 'sustenta'],
  coração: ['peito', 'espírito', 'âmago'],
  chama: ['luz', 'centelha', 'brasa'],
  farol: ['guia', 'archote', 'sinal'],
  brilhar: ['arder', 'resplandecer', 'luzir'],
  pessoa: ['alma', 'criatura', 'jovem'],
  penetrar: ['alcançar', 'mergulhar', 'descer'],
  profundezas: ['regiões', 'entranhas', 'sombras'],
  recônditas: ['distantes', 'íntimas', 'ocultas'],
  alma: ['consciência', 'essência', 'memória'],
  acender: ['reacender', 'avivar', 'despertar'],
  reside: ['está', 'mora', 'repousa'],
  finalidade: ['missão', 'razão', 'causa'],
  viver: ['existir', 'servir', 'caminhar'],

  // ---------------------------------------------- palavras de amarração
  // Curtas, mas viram alternativas cruéis: a frase inteira parece a mesma.
  sempre: ['nunca', 'ainda', 'jamais'],
  todos: ['alguns', 'muitos', 'poucos'],
  antes: ['depois', 'além', 'aquém'],
  além: ['aquém', 'antes', 'depois'],
  dentro: ['junto', 'perto', 'acima'],
  nossa: ['vossa', 'sua', 'minha'],
  nossos: ['vossos', 'seus', 'meus'],
  nosso: ['vosso', 'seu', 'meu'],
  nossas: ['vossas', 'suas', 'minhas'],
  vocês: ['nós', 'vós', 'todos'],
  cada: ['todo', 'qualquer', 'algum']
};

/**
 * Determinantes que sabem virar singular ou plural. Sem este par a troca de
 * número deixaria "nossos caminho" na tela — erro de português, não pegadinha.
 */
export const NUMERO_DETERMINANTES: Record<string, string> = {
  os: 'o', o: 'os',
  as: 'a', a: 'as',
  nossos: 'nosso', nosso: 'nossos',
  nossas: 'nossa', nossa: 'nossas',
  seus: 'seu', seu: 'seus',
  suas: 'sua', sua: 'suas',
  estes: 'este', este: 'estes',
  estas: 'esta', esta: 'estas',
  esses: 'esse', esse: 'esses',
  essas: 'essa', essa: 'essas',
  uns: 'um', um: 'uns',
  umas: 'uma', uma: 'umas',
  todos: 'todo', todo: 'todos',
  todas: 'toda', toda: 'todas'
};
