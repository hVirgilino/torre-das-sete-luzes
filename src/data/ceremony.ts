/**
 * Texto oficial da Cerimônia da Luz (Supremo Conselho DeMolay Brasil, 4ª ed., 2019).
 * Estruturado em seções: cada vela tem seu trecho; abertura e encerramento
 * entram no banco de questões conforme a dificuldade.
 */

export type SectionTier = 'abertura' | 'vela' | 'encerramento';

export interface CeremonySection {
  id: string;
  tier: SectionTier;
  /** Número da vela (1–7) quando tier === 'vela' */
  vela?: number;
  /** Nome da virtude, para UI */
  titulo: string;
  texto: string;
}

export const CEREMONY: CeremonySection[] = [
  {
    id: 'abertura',
    tier: 'abertura',
    titulo: 'O Altar e as Sete Velas',
    texto:
      'Estou de pé diante de vocês, neste sagrado Altar DeMolay, sobre o qual temos colocado os poderosos baluartes de nossa fé, a Bíblia Sagrada e os livros escolares. Não tão distante, descansa a bandeira de nossa querida pátria. E de pé, como sentinelas, estão estas sete velas acesas, faróis na escuridão, luzes para iluminar nossos caminhos, conforme viajamos, sempre adiante pela estrada da vida. Elas são os símbolos de tudo o que é correto e bom no mundo. São os modelos sobre os quais, nós, como DeMolays, prometemos basear nossas vidas.'
  },
  {
    id: 'vela-1',
    tier: 'vela',
    vela: 1,
    titulo: 'Amor Filial',
    texto:
      'A primeira vela simboliza o amor entre pais e filhos, aquele amor que já existia antes mesmo de nascermos, que permanece conosco durante toda a nossa vida e que nos seguirá até mesmo além do túmulo. Os sábios chamavam este amor de ágape, amor sem nenhuma outra razão, senão a de existir.'
  },
  {
    id: 'vela-2',
    tier: 'vela',
    vela: 2,
    titulo: 'Reverência pelas Coisas Sagradas',
    texto:
      'A segunda vela é o emblema da reverência por tudo aquilo que é sagrado. Um jovem, atravessando o limiar da Ordem DeMolay pela primeira vez, professa uma profunda e permanente fé, em um vivo e verdadeiro Deus. Sem esta inabalável fé e a graça de nosso Pai Celestial, nossos trabalhos seriam em vão.'
  },
  {
    id: 'vela-3',
    tier: 'vela',
    vela: 3,
    titulo: 'Cortesia',
    texto:
      'A terceira vela representa a Cortesia, uma Cortesia que transcende as amizades; que alcança os desconhecidos, os mais velhos e todos os homens. É esta Cortesia que traz um sentimento caloroso, e um sorriso que torna esta vida mais agradável para o próximo, pois ilumina o caminho diante de nós.'
  },
  {
    id: 'vela-4',
    tier: 'vela',
    vela: 4,
    titulo: 'Companheirismo',
    texto:
      'A quarta vela, no centro de nossas sete, representa simbolicamente o Companheirismo. Milhões de jovens como nós, já se ajoelharam neste Altar simbólico e se dedicaram aos mesmos elevados princípios de boa filiação e boa cidadania. Enquanto permanecermos fiéis a essas promessas, enquanto existir a Ordem DeMolay, seremos um.'
  },
  {
    id: 'vela-5',
    tier: 'vela',
    vela: 5,
    titulo: 'Fidelidade',
    texto:
      'A quinta vela representa simplesmente a Fidelidade. Um DeMolay não pode nunca, por motivo justificado ou não, ser falso a seus votos, suas promessas, seus amigos, seu Deus. Ele é chamado diariamente a defender os baluartes e preceitos da Ordem, de modo que jamais falhe como líder e como homem.'
  },
  {
    id: 'vela-6',
    tier: 'vela',
    vela: 6,
    titulo: 'Pureza',
    texto:
      'A sexta vela é o símbolo da Pureza, não a Pureza do corpo, a qual todos praticamos, mas a Pureza de todo o pensamento, palavra e ação. Somente puro, pode um DeMolay ser digno representante da pureza de nossos ensinamentos.'
  },
  {
    id: 'vela-7',
    tier: 'vela',
    vela: 7,
    titulo: 'Patriotismo',
    texto:
      'A última vela é o emblema do patriotismo. Talvez, nós nunca sejamos chamados a defender nossa pátria no campo de batalha, porém cada dia nos apresenta novas oportunidades para nos firmarmos como bons e corretos cidadãos, a serviço daquela querida bandeira e de nossa reverenciada pátria.'
  },
  {
    id: 'encerramento-1',
    tier: 'encerramento',
    titulo: 'A Época Turbulenta',
    texto:
      'Porém, nós vivemos em uma época turbulenta, quando os baluartes da Bíblia, da bandeira nacional e dos livros escolares correm o risco de se afundar em meio às ruínas da dúvida e da incerteza; quando estes sete gloriosos preceitos podem não ser os mais cobiçados modelos sobre os quais alguém pode basear sua vida; quando a confiança, a justiça e a fraternidade podem não ser consideradas as mais virtuosas das qualidades.'
  },
  {
    id: 'encerramento-2',
    tier: 'encerramento',
    titulo: 'A Defesa dos Ensinamentos',
    texto:
      'E se nós, como DeMolays, não permanecermos inabaláveis em defesa dos ensinamentos de nossa Ordem, se não procurarmos perpetuá-los em nossas vidas diárias, então, talvez, estas chamas se apagarão, silenciadas nas sombras, e a escuridão tomará conta do país.'
  },
  {
    id: 'encerramento-3',
    tier: 'encerramento',
    titulo: 'A Chama Interior',
    texto:
      'No entanto, cada um de vocês, como um DeMolay, carrega dentro de seu coração uma chama, um farol para guiá-los através da escuridão. Se puder fazer esta luz brilhar sobre outra pessoa, se puder penetrar nas profundezas mais recônditas de sua alma e acender sua chama, então aí reside a finalidade da Ordem DeMolay e aí está a sua finalidade de viver.'
  }
];

export const VIRTUDES = [
  'Amor Filial',
  'Reverência pelas Coisas Sagradas',
  'Cortesia',
  'Companheirismo',
  'Fidelidade',
  'Pureza',
  'Patriotismo'
];
