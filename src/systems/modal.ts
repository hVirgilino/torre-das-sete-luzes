import { Audio } from './audio';

export interface OpcoesModal {
  titulo: string;
  /** placeholder do campo */
  dica?: string;
  /** texto de apoio abaixo do campo */
  ajuda?: string;
  confirmar?: string;
  maxLength?: number;
  valor?: string;
  /** mostra "deixar em branco", que resolve com string vazia */
  opcional?: boolean;
}

/**
 * Modal de texto em DOM, sobre o canvas.
 *
 * É DOM de propósito: campo de texto dentro do Phaser não abre o teclado do
 * sistema no celular, não tem seleção nem autocorreção, e é justamente onde o
 * jogador digita o próprio nome.
 *
 * Resolve com `null` só quando fechado sem confirmar (Esc).
 */
export function pedirTexto(opcoes: OpcoesModal): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('name-overlay')!;
    const titulo = document.getElementById('name-title')!;
    const input = document.getElementById('name-input') as HTMLInputElement;
    const ajuda = document.getElementById('name-hint')!;
    const confirmar = document.getElementById('name-confirm')!;
    const pular = document.getElementById('name-skip') as HTMLButtonElement;

    // textContent, nunca innerHTML: o conteúdo pode vir de dado de jogador
    titulo.textContent = opcoes.titulo;
    ajuda.textContent = opcoes.ajuda ?? '';
    confirmar.textContent = opcoes.confirmar ?? 'Assim seja';
    input.placeholder = opcoes.dica ?? '';
    input.maxLength = opcoes.maxLength ?? 16;
    input.value = opcoes.valor ?? '';
    pular.hidden = !opcoes.opcional;

    overlay.classList.add('visible');
    setTimeout(() => input.focus(), 50);

    const encerrar = (valor: string | null) => {
      overlay.classList.remove('visible');
      confirmar.removeEventListener('click', aoConfirmar);
      pular.removeEventListener('click', aoPular);
      input.removeEventListener('keydown', aoTeclar);
      resolve(valor);
    };
    const aoConfirmar = () => {
      Audio.confirm();
      encerrar(input.value.trim());
    };
    const aoPular = () => encerrar('');
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Enter') aoConfirmar();
      else if (e.key === 'Escape') encerrar(null);
      // o Phaser escuta o teclado da cena por baixo; sem isto, digitar o nome
      // moveria o cavaleiro e dispararia atalhos do quiz
      e.stopPropagation();
    };

    confirmar.addEventListener('click', aoConfirmar);
    pular.addEventListener('click', aoPular);
    input.addEventListener('keydown', aoTeclar);
  });
}
