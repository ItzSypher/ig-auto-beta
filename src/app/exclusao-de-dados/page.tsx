import { LegalPage, P, Section, UL } from "@/components/LegalPage";

export const metadata = {
  title: "Exclusão de dados — VEMDM",
  description: "Como pedir a exclusão dos seus dados no VEMDM.",
};

const CONTATO = "arthurfoxinfo@gmail.com";

export default function ExclusaoPage() {
  return (
    <LegalPage title="Exclusão de dados" updated="9 de agosto de 2026">
      <P>
        Se você interagiu com a conta de Instagram conectada ao VEMDM e quer que
        todos os seus registros sejam apagados, o pedido é gratuito e não precisa
        de justificativa.
      </P>

      <Section title="Como pedir">
        <P>
          Envie um e-mail para{" "}
          <a className="underline" href={`mailto:${CONTATO}?subject=Exclus%C3%A3o%20de%20dados`}>
            {CONTATO}
          </a>{" "}
          com o assunto <strong>Exclusão de dados</strong> e informe o seu nome de
          usuário do Instagram (o @). Isso basta para localizar seus registros.
        </P>
        <P>
          Se preferir, mande uma mensagem direta para a própria conta de Instagram
          pedindo a exclusão. Vale igual.
        </P>
      </Section>

      <Section title="O que é apagado">
        <UL
          items={[
            "Seu identificador de usuário do Instagram e o seu nome de usuário.",
            "O histórico de interações suas que dispararam automações.",
            "As mensagens que foram enviadas para você e os respectivos status.",
            "Qualquer envio ainda pendente na fila destinado a você.",
          ]}
        />
        <P>
          A exclusão é definitiva: os registros são removidos do banco, não apenas
          ocultados.
        </P>
      </Section>

      <Section title="Em quanto tempo">
        <P>
          Em até 30 dias corridos a partir do recebimento do pedido, normalmente
          bem antes disso. Você recebe uma confirmação por e-mail quando terminar.
        </P>
      </Section>

      <Section title="O que não conseguimos apagar">
        <P>
          As mensagens que já foram entregues ficam também na sua própria caixa de
          entrada do Instagram, dentro dos sistemas da Meta. Essas não estão sob
          nosso controle — para removê-las, apague a conversa no aplicativo do
          Instagram ou fale com a Meta.
        </P>
      </Section>
    </LegalPage>
  );
}
