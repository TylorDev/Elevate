import { useEffect, useMemo, useState } from 'react'
import { LuLink, LuList, LuPencil, LuPlus, LuSparkles, LuTrash2, LuUnlink } from 'react-icons/lu'
import ConfirmActionModal from '../../ConfirmActionModal/ConfirmActionModal'
import Modal from '../../Modal/Modal'
import { UseViz } from '../../../Contexts/VisualizerContext'
import EmptyMessage from './EmptyMessage'
import ListItem from './ListItem'
import ModalHeader from './ModalHeader'
import ModalSection from './ModalSection'

function ListManagerTab() {
  const {
    presetLists,
    sourceAssociations,
    activePresetList,
    availableAssociationSources,
    createPresetList,
    renamePresetList,
    deletePresetList,
    associateSourceToList,
    removeSourceAssociation
  } = UseViz()

  const [selectedListId, setSelectedListId] = useState('')
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [editingListId, setEditingListId] = useState('')
  const [editRenameValue, setEditRenameValue] = useState('')
  const [editSourceKey, setEditSourceKey] = useState('')
  const [pendingDeleteList, setPendingDeleteList] = useState(null)

  useEffect(() => {
    setSelectedListId((currentId) => {
      if (presetLists.some((list) => list.id === currentId)) {
        return currentId
      }

      if (activePresetList?.id && presetLists.some((list) => list.id === activePresetList.id)) {
        return activePresetList.id
      }

      return presetLists[0]?.id || ''
    })
  }, [activePresetList?.id, presetLists])

  const selectedList = useMemo(
    () => presetLists.find((list) => list.id === selectedListId) || null,
    [presetLists, selectedListId]
  )

  const normalizedAssociationSources = useMemo(
    () =>
      availableAssociationSources.map((source) => ({
        ...source,
        sourceKey: source.sourceKey || `${source.type}:${source.id}`
      })),
    [availableAssociationSources]
  )

  const sourceByKey = useMemo(
    () => new Map(normalizedAssociationSources.map((source) => [source.sourceKey, source])),
    [normalizedAssociationSources]
  )

  const listAssociationCounts = useMemo(() => {
    const counts = new Map()

    Object.values(sourceAssociations || {}).forEach((listId) => {
      if (!listId) {
        return
      }

      counts.set(listId, (counts.get(listId) || 0) + 1)
    })

    return counts
  }, [sourceAssociations])

  const editingList = useMemo(
    () => presetLists.find((list) => list.id === editingListId) || null,
    [editingListId, presetLists]
  )

  const editingLinkedSources = useMemo(() => {
    if (!editingListId) {
      return []
    }

    return Object.entries(sourceAssociations || {})
      .filter(([, listId]) => listId === editingListId)
      .map(([sourceKey]) => sourceByKey.get(sourceKey))
      .filter(Boolean)
  }, [editingListId, sourceAssociations, sourceByKey])

  const availableSourcesForEdit = useMemo(() => {
    if (!editingListId) {
      return normalizedAssociationSources
    }

    const linkedKeys = new Set(editingLinkedSources.map((source) => source.sourceKey))
    return normalizedAssociationSources.filter((source) => !linkedKeys.has(source.sourceKey))
  }, [editingLinkedSources, editingListId, normalizedAssociationSources])

  useEffect(() => {
    if (!isEditModalVisible) {
      return
    }

    setEditRenameValue(editingList?.name || '')
  }, [editingList?.name, isEditModalVisible])

  useEffect(() => {
    if (!isEditModalVisible) {
      return
    }

    setEditSourceKey((currentKey) => {
      if (availableSourcesForEdit.some((source) => source.sourceKey === currentKey)) {
        return currentKey
      }

      return availableSourcesForEdit[0]?.sourceKey || ''
    })
  }, [availableSourcesForEdit, isEditModalVisible])

  const handleOpenCreateModal = () => {
    setNewListName('')
    setIsCreateModalVisible(true)
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalVisible(false)
    setNewListName('')
  }

  const handleOpenEditModal = (list) => {
    setEditingListId(list?.id || '')
    setEditRenameValue(list?.name || '')
    setEditSourceKey('')
    setIsEditModalVisible(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalVisible(false)
    setEditingListId('')
    setEditRenameValue('')
    setEditSourceKey('')
  }

  const handleCreateList = () => {
    const createdList = createPresetList(newListName)

    if (createdList?.id) {
      setSelectedListId(createdList.id)
      handleCloseCreateModal()
    }
  }

  const handleRenameList = () => {
    if (!editingList?.id) {
      return
    }

    renamePresetList(editingList.id, editRenameValue)
  }

  const handleDeleteListItem = (list) => {
    setPendingDeleteList(list || null)
  }

  const handleCancelDeleteListItem = () => {
    setPendingDeleteList(null)
  }

  const handleConfirmDeleteListItem = () => {
    const list = pendingDeleteList

    if (!list?.id) {
      return
    }

    if (editingListId === list.id) {
      handleCloseEditModal()
    }

    deletePresetList(list.id)
    setPendingDeleteList(null)
  }

  const handleManualAssociate = () => {
    const selectedSource = sourceByKey.get(editSourceKey)

    if (!selectedSource || !editingList?.id) {
      return
    }

    associateSourceToList(
      {
        type: selectedSource.type,
        id: selectedSource.id
      },
      editingList.id
    )
  }

  const handleManualRemoveAssociation = (source) => {
    if (!source) {
      return
    }

    removeSourceAssociation({
      type: source.type,
      id: source.id
    })
  }

  const trimmedNewListName = newListName.trim()
  const trimmedEditRenameValue = editRenameValue.trim()
  const hasPresetLists = presetLists.length > 0
  const hasEditingLinkedSources = editingLinkedSources.length > 0

  const renderPresetLists = () =>
    presetLists.map((list) => {
      const associationCount = listAssociationCounts.get(list.id) || 0

      return (
        <ListItem
          key={list.id}
          list={list}
          associationCount={associationCount}
          isSelected={selectedListId === list.id}
          isUnrelated={associationCount === 0}
          onDelete={handleDeleteListItem}
          onEdit={handleOpenEditModal}
          onSelect={() => setSelectedListId(list.id)}
        />
      )
    })

  return (
    <>
      <section>
        <article>
          <div>
            <div>
              <span>
                <LuList /> Lists
              </span>
              <small>Each ListItem shows its preset count and whether it is unrelated.</small>
            </div>
            <button onClick={handleOpenCreateModal} type="button">
              <LuPlus /> Create ListItem
            </button>
          </div>

          {hasPresetLists ? (
            <div>{renderPresetLists()}</div>
          ) : (
            <EmptyMessage
              icon={LuSparkles}
              title="No hay preset lists todavia."
              description="Crea tu primer ListItem para empezar a organizar presets."
            />
          )}
        </article>
      </section>

      <Modal isVisible={isCreateModalVisible} closeModal={handleCloseCreateModal}>
        <div>
          <ModalHeader
            icon={LuPlus}
            label="Create ListItem"
            title="Nueva preset list"
            description="Solo necesitas un nombre para crear una nueva lista de presets."
          />

          <label>
            <span>Nombre</span>
            <input
              type="text"
              value={newListName}
              placeholder="Ej. Late Night Visuals"
              onChange={(event) => setNewListName(event.target.value)}
              autoFocus
            />
          </label>

          <div>
            <button type="button" onClick={handleCloseCreateModal}>
              Cancelar
            </button>
            <button type="button" onClick={handleCreateList} disabled={!trimmedNewListName}>
              Crear
            </button>
          </div>
        </div>
      </Modal>

      <Modal isVisible={isEditModalVisible} closeModal={handleCloseEditModal}>
        <div>
          <ModalHeader
            icon={LuPencil}
            label="Edit List Item"
            title={editingList?.name || 'Editar ListItem'}
            description="Renombra la lista y administra sus source links desde un solo lugar."
          />

          <ModalSection title="Rename List Item">
            <div>
              <input
                type="text"
                value={editRenameValue}
                placeholder="Renombra la lista"
                onChange={(event) => setEditRenameValue(event.target.value)}
                disabled={!editingList}
              />
              <button
                type="button"
                onClick={handleRenameList}
                disabled={!editingList || !trimmedEditRenameValue}
              >
                <LuPencil /> Save
              </button>
            </div>
          </ModalSection>

          <ModalSection title="Remove Source Links" meta={`${editingLinkedSources.length} linked`}>
            {hasEditingLinkedSources ? (
              <div>
                {editingLinkedSources.map((source) => (
                  <div key={source.sourceKey}>
                    <span>{source.label}</span>
                    <button type="button" onClick={() => handleManualRemoveAssociation(source)}>
                      <LuUnlink /> Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div>No source links connected to this ListItem yet.</div>
            )}
          </ModalSection>

          <ModalSection title="Add Source Links" meta={`${availableSourcesForEdit.length} available`}>
            <div>
              <select
                value={editSourceKey}
                onChange={(event) => setEditSourceKey(event.target.value)}
                disabled={!editingList || availableSourcesForEdit.length === 0}
              >
                <option value="">Selecciona una fuente</option>
                {availableSourcesForEdit.map((source) => (
                  <option key={source.sourceKey} value={source.sourceKey}>
                    {source.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleManualAssociate}
                disabled={!editingList || !editSourceKey}
              >
                <LuLink /> Add Source Link
              </button>
            </div>
          </ModalSection>
        </div>
      </Modal>

      <ConfirmActionModal
        isVisible={Boolean(pendingDeleteList)}
        title="Delete List Item?"
        message={`This will permanently delete "${pendingDeleteList?.name || 'this list item'}".`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={handleCancelDeleteListItem}
        onConfirm={handleConfirmDeleteListItem}
      />
    </>
  )
}

export default ListManagerTab
