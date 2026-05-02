export interface EmbeddingItem {
  id: string
  modality: 'text' | 'image'
  timestamp: string
  source_path: string
  text_summary: string
  embedding: number[]
}

export interface ExperimentMetadata {
  experiment_name: string
  date: string
  timestamp: string
  type: 'interaction' | 'illumination'
  notes: string
}

export interface Experiment {
  experiment_path: string
  folder_date: string   // YYYY-MM-DD extracted from experiment_path — use this for date logic
  metadata: ExperimentMetadata
  items: EmbeddingItem[]
}

export interface EmbeddingsIndex {
  generated_at: string
  experiments: Experiment[]
}

export interface SearchResult {
  experiment: Experiment
  score: number
  textItem: EmbeddingItem
}
