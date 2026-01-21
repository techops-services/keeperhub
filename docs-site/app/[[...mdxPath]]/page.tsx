import { generateStaticParamsFor, importPage } from "nextra/pages";
import { notFound } from "next/navigation";
import { useMDXComponents } from "../../mdx-components";

export const generateStaticParams = generateStaticParamsFor("mdxPath");

export const dynamicParams = false;

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  try {
    const { metadata } = await importPage(params.mdxPath);
    return metadata;
  } catch {
    return { title: "Not Found" };
  }
}

type PageProps = {
  params: Promise<{ mdxPath?: string[] }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, ...rest } = result;
  const Wrapper = useMDXComponents().wrapper;

  return (
    <Wrapper {...rest}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
