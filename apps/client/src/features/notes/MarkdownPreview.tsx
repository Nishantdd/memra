import { CodeSnippet, Link } from "@carbon/react";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    input: [...(defaultSchema.attributes?.input ?? []), ["type", "checkbox"], "checked", "disabled"],
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]],
  },
};

const components: Components = {
  a: ({ href, children }) => {
    const external = !!href && /^https?:/i.test(href);
    return (
      <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
        {children}
      </Link>
    );
  },
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    if (className?.startsWith("language-") || text.includes("\n")) {
      return (
        <CodeSnippet type="multi" feedback="Copied" hideCopyButton wrapText>
          {text}
        </CodeSnippet>
      );
    }
    return <code>{children}</code>;
  },
  input: ({ checked }) => <input type="checkbox" checked={!!checked} disabled readOnly aria-label={checked ? "Done" : "To do"} />,
};

export const MarkdownPreview = memo(function MarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={`memra-markdown${className ? ` ${className}` : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
