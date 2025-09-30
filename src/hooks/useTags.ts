import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Tag } from '../types/database'

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setTags(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { tags, loading, error, refetch: fetchTags }
}

export async function addTagToLine(commercialLineId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('commercial_line_tag')
    .insert([{
      commercial_line_id: commercialLineId,
      tag_id: tagId
    }])

  if (error) throw error
}

export async function removeTagFromLine(commercialLineId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('commercial_line_tag')
    .delete()
    .eq('commercial_line_id', commercialLineId)
    .eq('tag_id', tagId)

  if (error) throw error
}

export async function addTagToAllLines(headerIds: string[], tagId: string): Promise<void> {
  // First get all line IDs for the given headers
  const { data: lines, error: linesError } = await supabase
    .from('commercial_line')
    .select('id')
    .in('hdr_id', headerIds)

  if (linesError) throw linesError
  if (!lines || lines.length === 0) return

  // Insert tags for all lines
  const tagData = lines.map(line => ({
    commercial_line_id: line.id,
    tag_id: tagId
  }))

  const { error } = await supabase
    .from('commercial_line_tag')
    .insert(tagData)

  if (error) throw error
}