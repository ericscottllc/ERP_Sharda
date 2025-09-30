import { useState } from 'react'
import { Tag, Plus, X } from 'lucide-react'
import { useTags, addTagToLine, removeTagFromLine, addTagToAllLines } from '../../hooks/useTags'
import { CommercialLine } from '../../types/database'
import { formatQuantityDisplay } from '../../utils/formatters'

interface TagsManagerProps {
  lines: CommercialLine[]
  onTagsUpdate?: () => void
  showInTabRow?: boolean
}

export function TagsManager({ lines, onTagsUpdate, showInTabRow = false }: TagsManagerProps) {
  const { tags } = useTags()
  const [showTagModal, setShowTagModal] = useState(false)
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectAll = () => {
    if (selectedLines.size === lines.length) {
      setSelectedLines(new Set())
    } else {
      setSelectedLines(new Set(lines.map(line => line.id)))
    }
  }

  const handleLineSelection = (lineId: string) => {
    const newSelected = new Set(selectedLines)
    if (newSelected.has(lineId)) {
      newSelected.delete(lineId)
    } else {
      newSelected.add(lineId)
    }
    setSelectedLines(newSelected)
  }

  const handleAddTag = async () => {
    if (!selectedTag || selectedLines.size === 0) return

    setLoading(true)
    setError(null)

    try {
      // Add tag to each selected line
      for (const lineId of selectedLines) {
        await addTagToLine(lineId, selectedTag)
      }

      setShowTagModal(false)
      setSelectedLines(new Set())
      setSelectedTag('')
      onTagsUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (lineId: string, tagId: string) => {
    try {
      await removeTagFromLine(lineId, tagId)
      onTagsUpdate?.()
    } catch (err) {
      console.error('Failed to remove tag:', err)
    }
  }

  // If showing in tab row, only return the button
  if (showInTabRow) {
    return (
      <>
        <button
          onClick={() => setShowTagModal(true)}
          className="inline-flex items-center px-3 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors"
        >
          <Tag className="h-4 w-4 mr-2" />
          Manage Tags
        </button>

        {/* Tag Management Modal */}
        {showTagModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Manage Line Tags</h3>
                <button
                  onClick={() => setShowTagModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              {/* Line Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Select Lines to Tag</h4>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-sharda-primary hover:text-sharda-secondary"
                  >
                    {selectedLines.size === lines.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                  {lines.map((line: any) => (
                    <div key={line.id} className="flex items-center p-3 border-b border-gray-100 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={selectedLines.has(line.id)}
                        onChange={() => handleLineSelection(line.id)}
                        className="h-4 w-4 text-sharda-primary focus:ring-sharda-primary border-gray-300 rounded mr-3"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          Line {line.line_no}: {line.item_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Qty: {formatQuantityDisplay(parseFloat(line.qty_ordered), line.item?.pack_size_details, (num) => num.toLocaleString())}
                        </div>
                        {line.tags && line.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {line.tags.map((lineTag: any) => (
                              <span
                                key={lineTag.tag_id}
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                                style={{
                                  backgroundColor: `${lineTag.tag.color}20`,
                                  color: lineTag.tag.color,
                                  border: `1px solid ${lineTag.tag.color}40`
                                }}
                              >
                                {lineTag.tag.name}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveTag(line.id, lineTag.tag_id)
                                  }}
                                  className="ml-1 hover:bg-red-200 rounded-full p-0.5"
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tag Selection */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Select Tag to Add</h4>
                <div className="grid grid-cols-1 gap-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="selectedTag"
                        value={tag.id}
                        checked={selectedTag === tag.id}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="h-4 w-4 text-sharda-primary focus:ring-sharda-primary border-gray-300 mr-3"
                      />
                      <div className="flex items-center flex-1">
                        <span
                          className="inline-flex px-3 py-1 text-sm font-medium rounded-full mr-3"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                            border: `1px solid ${tag.color}40`
                          }}
                        >
                          {tag.name}
                        </span>
                        {tag.description && (
                          <span className="text-sm text-gray-600">{tag.description}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowTagModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTag}
                  disabled={loading || !selectedTag || selectedLines.size === 0}
                  className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? 'Adding...' : `Add Tag to ${selectedLines.size} Line${selectedLines.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            Line Items ({lines.length})
          </h3>
          <button
            onClick={() => setShowTagModal(true)}
            className="inline-flex items-center px-3 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors"
          >
            <Tag className="h-4 w-4 mr-2" />
            Manage Tags
          </button>
        </div>
      </div>
    </div>
  )
}