import { Edit } from "@carbon/icons-react";
import { Breadcrumb, BreadcrumbItem, Column, Grid, IconButton, Loading } from "@carbon/react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useFolders, useNote, useTags } from "../../data/queries.ts";
import { formatAbsolute, formatRelative } from "../../lib/time.ts";
import { MarkdownPreview } from "./MarkdownPreview.tsx";
import { NoteTags } from "./NoteTags.tsx";

export function NotePage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const note = useNote(noteId!);
  const folders = useFolders() ?? [];
  const tags = useTags() ?? [];

  if (note.isPending)
    return (
      <div className="memra-loading">
        <Loading small withOverlay={false} description="Loading note" />
      </div>
    );
  if (note.isError || !note.data) return <Navigate to="/" replace />;

  const n = note.data;
  const folder = n.folderId ? folders.find((f) => f.id === n.folderId) : undefined;
  const noteTags = n.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t) => !!t);

  return (
    <Grid>
      <Column sm={4} md={8} lg={12}>
        <Breadcrumb noTrailingSlash className="memra-breadcrumb">
          <BreadcrumbItem>
            <Link to="/">All notes</Link>
          </BreadcrumbItem>
          {folder && (
            <BreadcrumbItem>
              <Link to={`/f/${folder.id}`}>{folder.name}</Link>
            </BreadcrumbItem>
          )}
          <BreadcrumbItem isCurrentPage>{n.displayTitle}</BreadcrumbItem>
        </Breadcrumb>
        <header className="memra-note-view__head">
          <h1 className="memra-note-view__title">{n.displayTitle}</h1>
          <IconButton
            label="Edit note"
            kind="ghost"
            size="md"
            align="bottom-end"
            onClick={() => void navigate(`/n/${n.id}/edit`)}
          >
            <Edit />
          </IconButton>
        </header>
        <div className="memra-note-view__meta">
          <NoteTags tags={noteTags} color={n.color} />
          <time
            className="memra-note__time"
            dateTime={new Date(n.updatedAt).toISOString()}
            title={formatAbsolute(n.updatedAt)}
          >
            Updated {formatRelative(n.updatedAt)}
          </time>
        </div>
        <MarkdownPreview
          markdown={n.bodyMd || "*This note is empty.*"}
          className="memra-note-view__body"
        />
      </Column>
    </Grid>
  );
}
