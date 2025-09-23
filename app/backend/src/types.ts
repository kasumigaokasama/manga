// Shared types and DB schema definitions for Kysely
import { ColumnType, Generated } from 'kysely'

export type Role = 'admin' | 'editor' | 'reader'
export type BookFormat = 'pdf' | 'epub' | 'cbz' | 'images'

export interface UsersTable {
  id: Generated<number>
  email: string
  passwordHash: string
  role: Role
  createdAt: ColumnType<string, string | undefined, never>
}

export interface BooksTable {
  id: Generated<number>
  title: string
  author: string | null
  format: BookFormat
  language: string | null
  pageCount: number | null
  filePath: string
  coverPath: string | null
  previewPath: string | null
  createdAt: ColumnType<string, string | undefined, never>
  updatedAt: ColumnType<string, string | undefined, string>
  deleted: ColumnType<number, number | undefined, number>
}

export interface TagsTable {
  id: Generated<number>
  name: string
}

export interface BookTagsTable {
  bookId: number
  tagId: number
}

export interface ReadingProgressTable {
  id: Generated<number>
  userId: number
  bookId: number
  page: number
  percent: number
  updatedAt: ColumnType<string, string | undefined, string>
}

export interface Database {
  users: UsersTable
  books: BooksTable
  tags: TagsTable
  book_tags: BookTagsTable
  reading_progress: ReadingProgressTable
}

export interface JwtPayload {
  sub: number
  email: string
  role: Role
}

