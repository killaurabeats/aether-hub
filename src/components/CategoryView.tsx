import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, SearchX, ShieldAlert } from "lucide-react";
import type { Category, Release } from "../types";
import { CATEGORY_META } from "../types";
import { useStore } from "../lib/store";
import { ReleaseCard } from "./ReleaseCard";

type Filter = "all" | "installed";
type Sort = "new" | "rating";

export function CategoryView({
  category,
  onOpenRelease,
}: {
  category: Category;
  onOpenRelease: (release: Release) => void;
}) {
  const { releases, installs, catalogLoading } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("new");

  const meta = CATEGORY_META[category];

  const items = useMemo(() => {
    let list = releases.filter((release) => release.category === category);
    if (filter === "installed") list = list.filter((release) => installs[release.slug]);
    if (sort === "rating") list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg);
    else
      list = [...list].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
      );
    return list;
  }, [releases, category, filter, sort, installs]);

  return (
    <div className="page">
      <div className="category-head">
        <div>
          <span className="eyebrow">Библиотека Aether</span>
          <h1>{meta.label}</h1>
          <p>
            {meta.sub} · {items.length} {items.length === 1 ? "релиз" : "релизов"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="filter-row">
            <button
              className={`filter-pill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Все
            </button>
            <button
              className={`filter-pill ${filter === "installed" ? "active" : ""}`}
              onClick={() => setFilter("installed")}
            >
              Установленные
            </button>
          </div>
          <div className="filter-row">
            <button
              className={`filter-pill ${sort === "new" ? "active" : ""}`}
              onClick={() => setSort("new")}
            >
              <Clock3 size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
              Новые
            </button>
            <button
              className={`filter-pill ${sort === "rating" ? "active" : ""}`}
              onClick={() => setSort("rating")}
            >
              ★ Рейтинг
            </button>
          </div>
        </div>
      </div>

      {catalogLoading && !items.length ? (
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
            {filter === "installed" ? "Здесь пока пусто" : "Релизов пока нет"}
          </h3>
          <p>
            {filter === "installed"
              ? "Установите что-нибудь из общей библиотеки — и это появится здесь."
              : "Админ ещё не опубликовал контент в этой категории. Загляните позже."}
          </p>
        </div>
      )}
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
  const { releases } = useStore();
  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return [];
    return releases.filter((release) => {
      const haystack = [
        release.title,
        release.description,
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
          <span className="eyebrow">Поиск</span>
          <h1>«{query.trim()}»</h1>
          <p>{matches.length} совпадений по каталогу</p>
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
          <h3>Ничего не найдено</h3>
          <p>Попробуйте короче: «vocal», «808», «preset».</p>
        </div>
      )}
    </div>
  );
}
