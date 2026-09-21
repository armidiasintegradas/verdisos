import { useEffect, useState, type FormEvent } from 'react'
import { useScope } from '@/features/scope/scope-provider'
import {
  createCounterparty,
  createMaterial,
  loadMasterData,
  type MasterCounterparty,
  type MasterMaterial,
} from '@/services/master-data/master-data-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { PageHeader } from '@/ui/components/page-header'

export function MasterDataPage() {
  const { activeScope } = useScope()
  const [materials, setMaterials] = useState<MasterMaterial[]>([])
  const [counterparties, setCounterparties] = useState<MasterCounterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [materialSubmitting, setMaterialSubmitting] = useState(false)
  const [counterpartySubmitting, setCounterpartySubmitting] = useState(false)

  const [materialCode, setMaterialCode] = useState('')
  const [materialName, setMaterialName] = useState('')
  const [materialCategory, setMaterialCategory] = useState('')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [counterpartyTaxId, setCounterpartyTaxId] = useState('')

  async function reload() {
    if (!activeScope) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await loadMasterData(activeScope)
      setMaterials(data.materials)
      setCounterparties(data.counterparties)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar os cadastros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [activeScope?.tenantId, activeScope?.organizationId, activeScope?.unitId])

  async function handleMaterialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeScope || materialSubmitting) return

    setMaterialSubmitting(true)
    setErrorMessage(null)
    try {
      await createMaterial(activeScope, {
        code: materialCode.trim(),
        name: materialName.trim(),
        category: materialCategory.trim(),
      })
      setMaterialCode('')
      setMaterialName('')
      setMaterialCategory('')
      await reload()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o material.')
    } finally {
      setMaterialSubmitting(false)
    }
  }

  async function handleCounterpartySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeScope || counterpartySubmitting) return

    setCounterpartySubmitting(true)
    setErrorMessage(null)
    try {
      await createCounterparty(activeScope, {
        name: counterpartyName.trim(),
        taxId: counterpartyTaxId.trim(),
      })
      setCounterpartyName('')
      setCounterpartyTaxId('')
      await reload()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar a contraparte.')
    } finally {
      setCounterpartySubmitting(false)
    }
  }

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Cadastros' }]} />
        <PageHeader
          title="Cadastros"
          description="Gerencie materiais e contrapartes usados nas operações da cooperativa."
        />
      </div>

      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {loading ? <p>Carregando cadastros…</p> : null}

      <section>
        <h2>Materiais</h2>
        <form onSubmit={handleMaterialSubmit}>
          <label>
            Código
            <input
              required
              value={materialCode}
              onChange={(event) => setMaterialCode(event.target.value)}
            />
          </label>
          <label>
            Nome
            <input
              required
              value={materialName}
              onChange={(event) => setMaterialName(event.target.value)}
            />
          </label>
          <label>
            Categoria
            <input
              required
              value={materialCategory}
              onChange={(event) => setMaterialCategory(event.target.value)}
            />
          </label>
          <button type="submit" disabled={materialSubmitting}>
            {materialSubmitting ? 'Salvando…' : 'Adicionar material'}
          </button>
        </form>

        <ul>
          {materials.map((material) => (
            <li key={material.id}>
              <strong>{material.name}</strong> · {material.code} · {material.category}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Origens e compradores</h2>
        <form onSubmit={handleCounterpartySubmit}>
          <label>
            Nome
            <input
              required
              value={counterpartyName}
              onChange={(event) => setCounterpartyName(event.target.value)}
            />
          </label>
          <label>
            CNPJ ou CPF
            <input
              value={counterpartyTaxId}
              onChange={(event) => setCounterpartyTaxId(event.target.value)}
            />
          </label>
          <button type="submit" disabled={counterpartySubmitting}>
            {counterpartySubmitting ? 'Salvando…' : 'Adicionar contraparte'}
          </button>
        </form>

        <ul>
          {counterparties.map((counterparty) => (
            <li key={counterparty.id}>
              <strong>{counterparty.name}</strong>
              {counterparty.taxId ? ' · ' + counterparty.taxId : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
