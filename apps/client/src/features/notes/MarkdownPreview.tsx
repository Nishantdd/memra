import { CodeSnippet, Link } from "@carbon/react";
import { memo, type ReactNode, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { INLINE_CODE_MAX } from "../../constants/index.ts";

const schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "cite"],
  },
  attributes: {
    ...defaultSchema.attributes,
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      ["type", "checkbox"],
      "checked",
      "disabled",
    ],
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]],
  },
};

export type LinkOverride = (href: string, children: ReactNode) => ReactNode | null;

const baseComponents: Components = {
  a: ({ href, children }) => {
    const external = !!href && /^https?:/i.test(href);
    return (
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </Link>
    );
  },
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const raw = Array.isArray(children)
      ? children.join("")
      : typeof children === "string"
        ? children
        : "";
    const text = raw.replace(/\n$/, "");
    if (className?.startsWith("language-") || text.includes("\n")) {
      return (
        <CodeSnippet type="multi" feedback="Copied" wrapText>
          {text}
        </CodeSnippet>
      );
    }
    return (
      <CodeSnippet type={text.length > INLINE_CODE_MAX ? "single" : "inline"} feedback="Copied">
        {text}
      </CodeSnippet>
    );
  },
  table: ({ children }) => (
    <div className="memra-markdown__scroll">
      <table>{children}</table>
    </div>
  ),
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={!!checked}
      disabled
      readOnly
      aria-label={checked ? "Done" : "To do"}
    />
  ),
};

interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
  /** Return a node to take over rendering of a link (e.g. `cite:` links), or null to fall back. */
  linkOverride?: LinkOverride;
}

export const MarkdownPreview = memo(function MarkdownPreview({
  markdown,
  className,
  linkOverride,
}: MarkdownPreviewProps) {
  const components = useMemo<Components>(() => {
    if (!linkOverride) return baseComponents;
    const BaseLink = baseComponents.a as (props: {
      href?: string;
      children?: ReactNode;
    }) => ReactNode;
    return {
      ...baseComponents,
      a: ({ href, children }) =>
        (href && linkOverride(href, children)) ?? <BaseLink href={href}>{children}</BaseLink>,
    };
  }, [linkOverride]);
  return (
    <div className={`memra-markdown${className ? ` ${className}` : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
