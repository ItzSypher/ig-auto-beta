import { LegalPage, P, Section, UL } from "@/components/LegalPage";

export const metadata = {
  title: "Política de Privacidade — VEMDM",
  description: "Como o VEMDM trata os dados de quem interage com o Instagram.",
};

const CONTATO = "arthurfoxinfo@gmail.com";

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updated="9 de agosto de 2026">
      <P>
        O VEMDM é uma ferramenta de uso próprio que automatiza respostas na conta
        profissional de Instagram do seu operador. Esta página explica quais dados
        ele guarda, por quê, e como pedir a exclusão deles.
      </P>

      <Section title="Quem é o responsável">
        <P>
          Os dados são tratados por Arthur Silva Moura, que opera a conta de
          Instagram conectada a este aplicativo. Contato:{" "}
          <a className="underline" href={`mailto:${CONTATO}`}>
            {CONTATO}
          </a>
          .
        </P>
      </Section>

      <Section title="Que dados são coletados">
        <P>
          Só coletamos o que a própria Meta envia quando você interage com a conta,
          e apenas quando essa interação dispara uma automação:
        </P>
        <UL
          items={[
            "Seu identificador de usuário do Instagram (um número atribuído pela Meta) e seu nome de usuário.",
            "O texto do comentário ou da mensagem que você enviou, quando ele contém uma das palavras-chave configuradas.",
            "A data e a hora dessa interação, usadas para respeitar o prazo de 24 horas que a Meta impõe para respostas.",
            "O registro das mensagens que o sistema enviou para você, com o status de entrega.",
          ]}
        />
        <P>
          <strong>Não</strong> coletamos sua senha, seu e-mail, seu telefone, sua
          lista de seguidores, suas mensagens com outras contas, nem qualquer dado
          de pagamento. Não temos acesso a nada disso.
        </P>
      </Section>

      <Section title="Para que servem">
        <P>
          Exclusivamente para responder você. O identificador serve para o envio
          chegar na conversa certa; o texto serve para decidir qual resposta
          mandar; os horários servem para não te enviar mensagem fora do prazo
          permitido pela Meta. Não há qualquer outro uso.
        </P>
      </Section>

      <Section title="O que nunca fazemos">
        <UL
          items={[
            "Não vendemos, alugamos nem compartilhamos seus dados com terceiros.",
            "Não usamos seus dados para treinar modelos nem para publicidade.",
            "Não enviamos mensagem para quem não interagiu antes com a conta.",
            "Não cruzamos seus dados com bases externas.",
          ]}
        />
      </Section>

      <Section title="Onde ficam guardados">
        <P>
          Em um banco de dados PostgreSQL hospedado no Supabase, com acesso restrito
          ao servidor da aplicação. O aplicativo roda na Vercel. Ambos são
          fornecedores de infraestrutura e atuam como operadores dos dados.
        </P>
      </Section>

      <Section title="Por quanto tempo">
        <P>
          Os registros de interação são mantidos enquanto forem necessários para o
          funcionamento das automações. Você pode pedir a exclusão a qualquer
          momento, e nesse caso ela é feita em até 30 dias.
        </P>
      </Section>

      <Section title="Seus direitos">
        <P>
          Pela LGPD (Lei 13.709/2018) você pode pedir confirmação do tratamento,
          acesso aos seus dados, correção, anonimização ou exclusão. Basta escrever
          para{" "}
          <a className="underline" href={`mailto:${CONTATO}`}>
            {CONTATO}
          </a>
          . As instruções detalhadas de exclusão estão em{" "}
          <a className="underline" href="/exclusao-de-dados">
            /exclusao-de-dados
          </a>
          .
        </P>
      </Section>

      <Section title="Mudanças nesta política">
        <P>
          Se algo mudar, a data no topo desta página é atualizada. Alterações
          relevantes no que coletamos serão descritas aqui.
        </P>
      </Section>
    </LegalPage>
  );
}
