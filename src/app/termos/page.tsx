import { LegalPage, P, Section, UL } from "@/components/LegalPage";

export const metadata = {
  title: "Termos de Serviço — VEMDM",
  description: "Regras de uso do VEMDM.",
};

const CONTATO = "arthurfoxinfo@gmail.com";

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Serviço" updated="9 de agosto de 2026">
      <P>
        O VEMDM é uma ferramenta de uso próprio que automatiza respostas na conta
        profissional de Instagram operada por Arthur Silva Moura. Não é um serviço
        aberto: não há cadastro, assinatura nem venda de acesso a terceiros.
      </P>

      <Section title="O que a ferramenta faz">
        <P>
          Quando alguém comenta em uma publicação, responde a um story ou envia uma
          mensagem contendo uma palavra-chave configurada, o VEMDM responde
          automaticamente — no comentário, no direct, ou nos dois.
        </P>
      </Section>

      <Section title="Uso aceitável">
        <P>A ferramenta é operada dentro das regras da plataforma. Isso significa:</P>
        <UL
          items={[
            "Nenhuma mensagem é enviada para quem não interagiu antes com a conta.",
            "Mensagens fora da janela de 24 horas permitida pela Meta não são enviadas.",
            "Não há compra, importação ou raspagem de listas de contatos.",
            "O ritmo de envio é limitado para não sobrecarregar a plataforma.",
          ]}
        />
        <P>
          O uso da ferramenta está sujeito aos Termos da Plataforma da Meta e às
          Políticas do Desenvolvedor, que prevalecem em caso de conflito com este
          documento.
        </P>
      </Section>

      <Section title="Se você recebeu uma mensagem automática">
        <P>
          Você pode parar de receber a qualquer momento: basta responder pedindo, ou
          bloquear a conta no Instagram. Nenhum dos dois tem custo nem exige
          justificativa. Para apagar seus dados, veja{" "}
          <a className="underline" href="/exclusao-de-dados">
            /exclusao-de-dados
          </a>
          .
        </P>
      </Section>

      <Section title="Sem garantias">
        <P>
          A ferramenta depende de serviços de terceiros — Instagram, Meta, Supabase e
          Vercel. Indisponibilidade, atraso ou falha de entrega podem acontecer e não
          geram obrigação de indenizar. O serviço é fornecido no estado em que se
          encontra.
        </P>
      </Section>

      <Section title="Privacidade">
        <P>
          O tratamento de dados está descrito em{" "}
          <a className="underline" href="/privacidade">
            /privacidade
          </a>
          .
        </P>
      </Section>

      <Section title="Contato">
        <P>
          Dúvidas sobre estes termos:{" "}
          <a className="underline" href={`mailto:${CONTATO}`}>
            {CONTATO}
          </a>
          .
        </P>
      </Section>
    </LegalPage>
  );
}
