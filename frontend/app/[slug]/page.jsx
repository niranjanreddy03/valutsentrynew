import { FeaturePage } from "../components"
import { featureBySlug } from "../data"

export function generateStaticParams() {
  return Object.keys(featureBySlug).map((slug) => ({ slug }))
}

export default async function DynamicFeaturePage({ params }) {
  const { slug } = await params
  const feature = featureBySlug[slug] || {
    slug,
    label: titleFromSlug(slug),
    icon: "web_asset",
    summary: "V2 feature page prepared for this route.",
    href: `/${slug}`,
  }

  return <FeaturePage feature={feature} active={feature.slug} />
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
