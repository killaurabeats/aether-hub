import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, SearchX, ShieldAlert } from "lucide-react";
import type { Category, Release } from "../types";
import { CATEGORY_META } from "../types";
import { useStore } from "../lib/store";
import { ReleaseCard } from "./ReleaseCard";

type Filter = "all" | "installed";
type TierFilter = "all" | "free" | "pro" | "beta";
type Sort = "new" | "rating";

export function CategoryView({
  category,
  onOpenRelease,
}: {
  category: Category;
  onOpenRelease: (release: Release) => void;
}) {
  const { releases, installs, catalogLoading, t } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sort, setSort] = useState<Sort>("new");

  const meta = CATEGORY_META[category];
  const categoryTotal = releases.filter((release) => release.category === category).length;
  const showFilters = !(
    (category === "drumkits" || category === "presets") &&
    categoryTotal === 0
  );

  const items = useMemo(() => {
    let list = releases.filter((release) => release.category === category);
    if (filter === "installed") list = list.filter((release) => installs[release.slug]);
    if (category === "plugins" && tierFilter !== "all") {
      list = list.filter((release) => (release.tier ?? "free") === tierFilter);
    }
    if (sort === "rating") list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg);
    else
      list = [...list].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
      );
    return list;
  }, [releases, category, filter, tierFilter, sort, installs]);

  return (
    <div className="page">
      <div className="category-head">
        <div>
          <span className="eyebrow">{t("Библиотека Aether")}</span>
          <h1>{meta.label}</h1>
          <p>
            {meta.sub} · {t("Релизов: {count}", { count: items.length })}
          </p>
        </div>

        {showFilters ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="filter-row">
            <button
              className={`filter-pill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              {t("Все")}
            </button>
            <button
              className={`filter-pill ${filter === "installed" ? "active" : ""}`}
              onClick={() => setFilter("installed")}
            >
              {t("Установленные")}
            </button>
          </div>
          {category === "plugins" ? (
            <div className="filter-row">
              <button
                className={`filter-pill ${tierFilter === "all" ? "active" : ""}`}
                onClick={() => setTierFilter("all")}
              >
                {t("Все")}
              </button>
              <button
                className={`filter-pill ${tierFilter === "free" ? "active" : ""}`}
                onClick={() => setTierFilter("free")}
              >
                FREE
              </button>
              <button
                className={`filter-pill ${tierFilter === "pro" ? "active" : ""}`}
                onClick={() => setTierFilter("pro")}
              >
                PRO
              </button>
              <button
                className={`filter-pill beta ${tierFilter === "beta" ? "active" : ""}`}
                onClick={() => setTierFilter("beta")}
              >
                BETA
              </button>
            </div>
          ) : null}
          <div className="filter-row">
            <button
              className={`filter-pill ${sort === "new" ? "active" : ""}`}
              onClick={() => setSort("new")}
            >
              <Clock3 size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
              {t("Новые")}
            </button>
            <button
              className={`filter-pill ${sort === "rating" ? "active" : ""}`}
              onClick={() => setSort("rating")}
            >
              ★ {t("Рейтинг")}
            </button>
          </div>
        </div>
        ) : null}
      </div>

      {(category === "drumkits" || category === "presets") && categoryTotal === 0 ? (
        <SoonPanel
          subtitle={
            category === "drumkits"
              ? t("Скоро здесь появятся драм-киты")
              : t("Скоро здесь появятся пресеты")
          }
        />
      ) : catalogLoading && !items.length ? (
        <div className="release-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass" style={{ height: 268 }}>
              <div className="skeleton" style={{ height: 168, borderRadius: "22px 22px 0 0" }} />
              <div style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 14, width: "60%" }} />
                <div className="skeleton" style={{ height: 10, width: "90%", marginTop: 10 }} />
              </div>
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div className="release-grid">
          {items.map((release, index) => (
            <ReleaseCard key={release.id} release={release} onOpen={onOpenRelease} index={index} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon">
            {filter === "installed" ? <CheckCircle2 size={22} /> : <ShieldAlert size={22} />}
          </div>
          <h3>
            {filter === "installed" ? t("Здесь пока пусто") : t("Релизов пока нет")}
          </h3>
          <p>
            {filter === "installed"
              ? t("Установите что-нибудь из общей библиотеки - и это появится здесь.")
              : t("Админ ещё не опубликовал контент в этой категории. Загляните позже.")}
          </p>
        </div>
      )}
    </div>
  );
}

function SoonPanel({ subtitle }: { subtitle: string }) {
  return (
    <div className="soon-panel glass">
      <span className="soon-orb soon-orb-a" />
      <span className="soon-orb soon-orb-b" />
      <div className="soon-ring" />
      <div className="soon-word">SOON</div>
      <p>{subtitle}</p>
      <span className="soon-line" />
    </div>
  );
}

export function SearchResults({
  query,
  onOpenRelease,
}: {
  query: string;
  onOpenRelease: (release: Release) => void;
}) {
  const { releases, t } = useStore();
  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return [];
    return releases.filter((release) => {
      const haystack = [
        release.title,
        release.description,
        release.descriptionRu ?? "",
        release.descriptionEn ?? "",
        release.slug,
        release.category,
        release.productTag ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [releases, needle]);

  return (
    <div className="page">
      <div className="category-head">
        <div>
          <span className="eyebrow">{t("Поиск")}</span>
          <h1>{t("«{query}»", { query: query.trim() })}</h1>
          <p>{t("{count} совпадений по каталогу", { count: matches.length })}</p>
        </div>
      </div>

      {matches.length ? (
        <div className="release-grid">
          {matches.map((release, index) => (
            <ReleaseCard key={release.id} release={release} onOpen={onOpenRelease} index={index} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon">
            <SearchX size={22} />
          </div>
          <h3>{t("Ничего не найдено")}</h3>
          <p>{t("Попробуйте короче: «vocal», «808», «preset».")}</p>
        </div>
      )}
    </div>
  );
}
