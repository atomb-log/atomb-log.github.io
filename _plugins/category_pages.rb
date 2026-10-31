# frozen_string_literal: true

require "digest"

module AtombLog
  # Keep desktop shortcuts available before their first Markdown post is written.
  class CategoryPages < Jekyll::Generator
    safe true
    priority :normal

    def generate(site)
      site.config["category_urls"] = {}
      configured = Array(site.data["notebook_categories"]).to_h { |category| [category.fetch("name"), category] }
      names = (configured.keys + site.categories.keys.sort_by(&:to_s)).uniq
      used_slugs = {}

      names.each do |name|
        # About is a standalone Markdown page, with no category archive wrapper.
        if (direct_url = configured.dig(name, "url"))
          site.config["category_urls"][name] = direct_url
          next
        end
        posts = site.categories.fetch(name, [])
        slug = configured.dig(name, "slug") || Jekyll::Utils.slugify(name, :mode => "default")
        # Keep ordinary Korean names readable, while avoiding collisions such as
        # C++, C#, and C or category names differing only in case on Windows.
        if slug.empty? || (!configured.key?(name) && (slug != name || used_slugs.key?(slug.downcase)))
          slug = "#{slug.empty? ? 'category' : slug}-#{Digest::SHA256.hexdigest(name)[0, 8]}"
        end
        used_slugs[slug.downcase] = true

        page = Jekyll::PageWithoutAFile.new(site, site.source, "categories/#{slug}", "index.html")
        page.data.merge!(
          "layout" => "category",
          "title" => name,
          "category" => name,
          "description" => "#{name} 카테고리의 기록을 연도별로 모았습니다.",
          "posts" => posts.sort_by(&:date).reverse,
          "permalink" => "/categories/#{slug}/"
        )

        site.pages << page
        site.config["category_urls"][name] = page.url
      end
    end
  end
end
