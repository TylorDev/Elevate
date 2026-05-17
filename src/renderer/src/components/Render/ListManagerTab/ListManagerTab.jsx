import { useEffect, useMemo, useState } from 'react'
import { LuLink, LuList, LuPencil, LuPlus, LuSparkles, LuTrash2, LuUnlink } from 'react-icons/lu'
import ConfirmActionModal from '../../ConfirmActionModal/ConfirmActionModal'
import Modal from '../../Modal/Modal'
import { UseViz } from '../../../Contexts/VisualizerContext'
import './ListManagerTab.scss'

function ListItem({
  list,
  associationCount,
  isSelected,
  isUnrelated,
  onDelete,
  onEdit,
  onSelect
}) {
  const presetCount = Array.isArray(list?.presetNames) ? list.presetNames.length : 0

  return (
    <button
      type="button"
      className={`list-manager-item ${isSelected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="list-manager-item__header">
        <div>
          <span className="list-manager-item__eyebrow">ListItem</span>
          <strong>{list?.name || 'Sin nombre'}</strong>
        </div>
        <span className={`list-manager-item__badge ${isUnrelated ? 'is-unrelated' : ''}`}>
          {isUnrelated ? 'Unrelated' : 'Linked'}
        </span>
      </div>

      <div className="list-manager-item__meta">
        <span>{presetCount} presets</span>
        <span>{associationCount} source links</span>
      </div>

      <div className="list-manager-item__actions">
        <button
          type="button"
          className="list-manager-item__edit-btn"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(list)
          }}
        >
          <LuPencil /> Edit List Item
        </button>
        <button
          type="button"
          className="list-manager-item__delete-btn"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(list)
          }}
        >
          <LuTrash2 /> Delete List Item
        </button>
      </div>
    </button>
  )
}

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
    () =>
      new Map(normalizedAssociationSources.map((source) => [source.sourceKey, source])),
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

  return (
    <>
      <section className="preset-tab-view list-manager-tab">
        <div className="list-manager-tab__layout">
          <article className="manager-card list-manager-tab__lists-card">
            <div className="manager-card__header list-manager-tab__header">
              <div>
                <span className="config-label">
                  <LuList /> Lists
                </span>
                <small>Each ListItem shows its preset count and whether it is unrelated.</small>
              </div>
              <button className="action-btn primary" onClick={handleOpenCreateModal} type="button">
                <LuPlus /> Create ListItem
              </button>
            </div>

            {presetLists.length === 0 ? (
              <div className="empty-state empty-state--compact list-manager-tab__empty">
                <LuSparkles className="empty-icon" />
                <p>No hay preset lists todavia.</p>
                <small>Crea tu primer ListItem para empezar a organizar presets.</small>
              </div>
            ) : (
              <div className="list-manager-tab__list-container">
                {presetLists.map((list) => {
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
                })}
              </div>
            )}
          </article>
        </div>
      </section>

      <Modal
        isVisible={isCreateModalVisible}
        closeModal={handleCloseCreateModal}
        contentClassName="list-manager-create-modal"
      >
        <div className="list-manager-create-modal__body">
          <div className="list-manager-create-modal__header">
            <span className="config-label">
              <LuPlus /> Create ListItem
            </span>
            <h3>Nueva preset list</h3>
            <p>Solo necesitas un nombre para crear una nueva lista de presets.</p>
          </div>

          <label className="list-manager-create-modal__field">
            <span>Nombre</span>
            <input
              className="manager-input"
              type="text"
              value={newListName}
              placeholder="Ej. Late Night Visuals"
              onChange={(event) => setNewListName(event.target.value)}
              autoFocus
            />
          </label>

          <div className="list-manager-create-modal__actions">
            <button type="button" className="action-btn" onClick={handleCloseCreateModal}>
              Cancelar
            </button>
            <button
              type="button"
              className="action-btn primary"
              onClick={handleCreateList}
              disabled={!trimmedNewListName}
            >
              Crear
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isVisible={isEditModalVisible}
        closeModal={handleCloseEditModal}
        contentClassName="list-manager-edit-modal"
      >
        <div className="list-manager-edit-modal__body">
          <div className="list-manager-edit-modal__header">
            <span className="config-label">
              <LuPencil /> Edit List Item
            </span>
            <h3>{editingList?.name || 'Editar ListItem'}</h3>
            <p>Renombra la lista y administra sus source links desde un solo lugar.</p>
          </div>

          <section className="list-manager-edit-modal__section">
            <div className="list-manager-edit-modal__section-head">
              <strong>Rename List Item</strong>
            </div>
            <div className="list-create-row">
              <input
                className="manager-input"
                type="text"
                value={editRenameValue}
                placeholder="Renombra la lista"
                onChange={(event) => setEditRenameValue(event.target.value)}
                disabled={!editingList}
              />
              <button
                type="button"
                className="action-btn"
                onClick={handleRenameList}
                disabled={!editingList || !trimmedEditRenameValue}
              >
                <LuPencil /> Save
              </button>
            </div>
          </section>

          <section className="list-manager-edit-modal__section">
            <div className="list-manager-edit-modal__section-head">
              <strong>Remove Source Links</strong>
              <span>{editingLinkedSources.length} linked</span>
            </div>

            {editingLinkedSources.length === 0 ? (
              <div className="list-manager-edit-modal__empty">
                No source links connected to this ListItem yet.
              </div>
            ) : (
              <div className="list-manager-edit-modal__links">
                {editingLinkedSources.map((source) => (
                  <div key={source.sourceKey} className="list-manager-edit-modal__link-row">
                    <span>{source.label}</span>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => handleManualRemoveAssociation(source)}
                    >
                      <LuUnlink /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="list-manager-edit-modal__section">
            <div className="list-manager-edit-modal__section-head">
              <strong>Add Source Links</strong>
              <span>{availableSourcesForEdit.length} available</span>
            </div>
            <div className="manager-stack">
              <select
                className="manager-select"
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
                className="action-btn"
                onClick={handleManualAssociate}
                disabled={!editingList || !editSourceKey}
              >
                <LuLink /> Add Source Link
              </button>
            </div>
          </section>
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
