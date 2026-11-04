import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import type { JobCreatePayload } from '@/types/jobs';
import {
  generateIdempotencyKey,
  normalizeImageFilename,
  normalizeImageMimeType,
} from '@/services/jobService';

const DRAFT_KEY = 'headsup_project_draft_v2';
const MAX_IMAGES = 10;

const C = {
  background: '#FCFAF6',
  surface: '#FFFFFF',
  text: '#141413',
  muted: '#5C616B',
  border: '#EAE2D3',
  yellow: '#FFCC00',
  yellowLight: '#FFF8D6',
  danger: '#B91C1C',
  success: '#15803D',
  dark: '#141413',
  subtle: '#F5F2EB',
};

const STEPS = [
  { title: 'Project overview', subtitle: 'Start with the essentials of your project.' },
  { title: 'Workforce', subtitle: 'Tell us which people and services you need.' },
  { title: 'Budget & timeline', subtitle: 'Define the compensation and duration.' },
  { title: 'Project location', subtitle: 'Where will the work be performed?' },
  { title: 'Project photos', subtitle: 'Add photos to help applicants understand the site.' },
  { title: 'Review project', subtitle: 'One final look before you publish.' },
];

type ProjectForm = {
  title: string;
  description: string;
  project_type: 'INDUSTRIAL' | 'RESIDENTIAL' | 'COMMERCIAL';
  worker_category: string;
  trade_type: string;
  total_workers_required: string;
  wage_type: 'PER_DAY_WAGE' | 'CONTRACTUAL';
  wage_min: string;
  wage_max: string;
  contract_price: string;
  duration_days: string;
  start_date: string;
  location: string;
  geo_lat: string;
  geo_lng: string;
  special_requirements: string;
};

type SelectedImage = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type SkillCategory = {
  id: string;
  name: string;
  slug?: string;
};

type SelectionOption = {
  label: string;
  value: string;
  description?: string;
};

type SelectionSheetState = {
  title: string;
  subtitle?: string;
  value: string;
  items: SelectionOption[];
  onSelect: (value: string) => void;
};

type Props = {
  skillCategories?: SkillCategory[];
  loadSkills?: () => Promise<SkillCategory[]>;
  createProject: (
    payload: JobCreatePayload,
    idempotencyKey?: string,
  ) => Promise<unknown>;
  uploadImage: (image: SelectedImage) => Promise<string>;
};

const INITIAL: ProjectForm = {
  title: '',
  description: '',
  project_type: 'INDUSTRIAL',
  worker_category: '',
  trade_type: '',
  total_workers_required: '10',
  wage_type: 'PER_DAY_WAGE',
  wage_min: '',
  wage_max: '',
  contract_price: '',
  duration_days: '30',
  start_date: '',
  location: '',
  geo_lat: '',
  geo_lng: '',
  special_requirements: '',
};

const PROJECT_TYPES: SelectionOption[] = [
  {
    label: 'Industrial',
    value: 'INDUSTRIAL',
    description: 'Factories, warehouses and industrial sites',
  },
  {
    label: 'Commercial',
    value: 'COMMERCIAL',
    description: 'Offices, retail and commercial spaces',
  },
  {
    label: 'Residential',
    value: 'RESIDENTIAL',
    description: 'Homes, apartments and residential projects',
  },
];

const WORKER_CATEGORIES: SelectionOption[] = [
  {
    label: 'Skilled',
    value: 'Skilled',
    description: 'Experienced or technically trained workers',
  },
  {
    label: 'Semi-skilled',
    value: 'Semi-Skilled',
    description: 'Workers with some training or experience',
  },
  {
    label: 'Unskilled',
    value: 'Unskilled',
    description: 'General labour and support work',
  },
];

const WAGE_TYPES: SelectionOption[] = [
  {
    label: 'Daily wages',
    value: 'PER_DAY_WAGE',
    description: 'Set a minimum and maximum daily rate',
  },
  {
    label: 'Fixed contract',
    value: 'CONTRACTUAL',
    description: 'Set a total contract amount',
  },
];

export default function CreateProjectWizard({
  skillCategories = [],
  loadSkills,
  createProject,
  uploadImage,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProjectForm>(INITIAL);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skills, setSkills] = useState<SkillCategory[]>(skillCategories);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [selectionSheet, setSelectionSheet] =
    useState<SelectionSheetState | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // Cache uploaded URLs by local URI so retrying submission doesn't re-upload already uploaded images
  const uploadedUrlsRef = useRef<Record<string, string>>({});
  const idempotencyKeyRef = useRef<string>('');

  const fetchAvailableSkills = useCallback(async () => {
    if (!loadSkills) return;
    setLoadingSkills(true);
    try {
      const result = await loadSkills();
      setSkills(result);
    } catch {
      // Handled by inline retry notice in Step 1
    } finally {
      setLoadingSkills(false);
    }
  }, [loadSkills]);

  useEffect(() => {
    let alive = true;

    async function restoreDraft() {
      try {
        const saved = await AsyncStorage.getItem(DRAFT_KEY);

        if (saved && alive) {
          const parsed = JSON.parse(saved);
          setForm({ ...INITIAL, ...parsed.form });
        }
      } catch {
        // Ignore invalid saved draft data.
      } finally {
        if (alive) setRestored(true);
      }
    }

    void restoreDraft();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loadSkills) return;

    let alive = true;

    loadSkills()
      .then((result) => {
        if (alive) setSkills(result);
      })
      .catch(() => {
        // Handled by inline retry notice in Step 1
      });

    return () => {
      alive = false;
    };
  }, [loadSkills]);

  useEffect(() => {
    if (!restored) return;

    const timeout = setTimeout(() => {
      AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ form }),
      ).catch(() => {});
    }, 400);

    return () => clearTimeout(timeout);
  }, [form, restored]);

  const update = useCallback(
    <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => {
      setForm((previous) => ({ ...previous, [key]: value }));

      setErrors((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const tradeOptions = useMemo(
    () =>
      skills.map((skill) => ({
        label: skill.name,
        value: skill.id,
        description: skill.slug?.replace(/-/g, ' '),
      })),
    [skills],
  );

  function validateStep(index: number) {
    const nextErrors: Record<string, string> = {};

    if (index === 0) {
      const trimmedTitle = form.title.trim();
      const trimmedDesc = form.description.trim();

      if (!trimmedTitle) {
        nextErrors.title = 'Enter a project title.';
      } else if (trimmedTitle.length < 3) {
        nextErrors.title = 'Project title must be at least 3 characters.';
      } else if (trimmedTitle.length > 200) {
        nextErrors.title = 'Project title must be 200 characters or fewer.';
      }

      if (!trimmedDesc) {
        nextErrors.description = 'Describe the work required.';
      } else if (trimmedDesc.length < 10) {
        nextErrors.description =
          'Please provide at least 10 characters describing the work.';
      }
    }

    if (index === 1) {
      if (!form.worker_category) {
        nextErrors.worker_category = 'Select a worker category.';
      }

      if (!form.trade_type) {
        nextErrors.trade_type = 'Select a trade or service.';
      }

      const count = Number(form.total_workers_required);

      if (!Number.isInteger(count) || count < 1 || count > 10000) {
        nextErrors.total_workers_required =
          'Enter a valid worker count (1 to 10,000).';
      }
    }

    if (index === 2) {
      const duration = Number(form.duration_days);

      if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
        nextErrors.duration_days =
          'Duration must be between 1 and 3,650 days.';
      }

      if (form.wage_type === 'PER_DAY_WAGE') {
        const min = Number(form.wage_min);
        const max = Number(form.wage_max);

        if (
          form.wage_min.trim() === '' ||
          !Number.isFinite(min) ||
          min < 0
        ) {
          nextErrors.wage_min = 'Enter a valid minimum daily wage.';
        }

        if (
          form.wage_max.trim() === '' ||
          !Number.isFinite(max) ||
          max < min
        ) {
          nextErrors.wage_max =
            'Maximum wage must be at least the minimum wage.';
        }
      } else {
        const price = Number(form.contract_price);

        if (
          form.contract_price.trim() === '' ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          nextErrors.contract_price = 'Enter a valid contract price.';
        }
      }

      if (form.start_date.trim()) {
        const trimmedDate = form.start_date.trim();
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        const parsedDate = new Date(`${trimmedDate}T00:00:00Z`);

        if (
          !datePattern.test(trimmedDate) ||
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== trimmedDate
        ) {
          nextErrors.start_date = 'Use a valid YYYY-MM-DD date.';
        }
      }
    }

    if (index === 3) {
      const trimmedLoc = form.location.trim();
      if (!trimmedLoc) {
        nextErrors.location = 'Enter the project site address.';
      } else if (trimmedLoc.length > 255) {
        nextErrors.location = 'Site address must be 255 characters or fewer.';
      }

      const latStr = form.geo_lat.trim();
      const lngStr = form.geo_lng.trim();
      if (latStr || lngStr) {
        if (!latStr || !lngStr) {
          nextErrors.geo_lat =
            'Provide both latitude and longitude, or leave both blank.';
        } else {
          const lat = Number(latStr);
          const lng = Number(lngStr);
          if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            nextErrors.geo_lat = 'Latitude must be between -90 and 90.';
          }
          if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            nextErrors.geo_lng = 'Longitude must be between -180 and 180.';
          }
        }
      }
    }

    if (index === 4 && images.length === 0) {
      nextErrors.images = 'Add at least one photo before continuing.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function previousStep() {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  }

  function openSelector(
    title: string,
    value: string,
    items: SelectionOption[],
    onSelect: (value: string) => void,
    subtitle?: string,
  ) {
    setSelectionSheet({ title, value, items, onSelect, subtitle });
  }

  async function chooseImages(source: 'camera' | 'gallery') {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Image limit reached', 'You can add up to 10 images.');
      return;
    }

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          `Allow ${source === 'camera' ? 'camera' : 'photo library'} access to add project images.`,
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync({
              ...options,
              allowsMultipleSelection: true,
              selectionLimit: MAX_IMAGES - images.length,
            });

      if (result.canceled) return;

      const selected: SelectedImage[] = result.assets.map((asset, index) => {
        const mimeType = normalizeImageMimeType(asset.mimeType, asset.fileName ?? undefined);
        const name = normalizeImageFilename(
          asset.fileName ?? `project-${Date.now()}-${index}`,
          mimeType,
        );
        return {
          uri: asset.uri,
          name,
          mimeType,
          size: asset.fileSize,
        };
      });

      setImages((current) =>
        [...current, ...selected].slice(0, MAX_IMAGES),
      );

      setErrors((current) => {
        const next = { ...current };
        delete next.images;
        return next;
      });
    } catch {
      Alert.alert(
        'Could not select photos',
        'Please try again or choose different images.',
      );
    }
  }

  async function publish() {
    if (saving) return;

    for (let index = 0; index < STEPS.length - 1; index += 1) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    if (images.length === 0) {
      setStep(4);
      setErrors((current) => ({
        ...current,
        images: 'Add at least one photo before publishing.',
      }));
      return;
    }

    setSaving(true);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }

    try {
      const uploadedUrls: string[] = [];

      for (let index = 0; index < images.length; index += 1) {
        const img = images[index];
        const cachedUrl = uploadedUrlsRef.current[img.uri];

        if (cachedUrl) {
          uploadedUrls.push(cachedUrl);
          continue;
        }

        setUploadStatus(`Uploading photo ${index + 1} of ${images.length}...`);

        const url = await uploadImage(img);

        if (!url) {
          throw new Error(`Photo ${index + 1} did not return a public URL.`);
        }

        uploadedUrlsRef.current[img.uri] = url;
        uploadedUrls.push(url);
      }

      setUploadStatus('Creating your project...');

      const hasCoords =
        form.geo_lat.trim() !== '' && form.geo_lng.trim() !== '';

      const payload: JobCreatePayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        project_type: form.project_type,
        worker_category: form.worker_category,
        trade_type: form.trade_type,
        total_workers_required: Number(form.total_workers_required),
        wage_type: form.wage_type,
        wage_min:
          form.wage_type === 'CONTRACTUAL'
            ? null
            : Number(form.wage_min),
        wage_max:
          form.wage_type === 'CONTRACTUAL'
            ? null
            : Number(form.wage_max),
        contract_price:
          form.wage_type === 'CONTRACTUAL'
            ? Number(form.contract_price)
            : null,
        duration_days: Number(form.duration_days),
        start_date: form.start_date.trim() || null,
        location: form.location.trim(),
        geo_lat: hasCoords ? Number(form.geo_lat.trim()) : null,
        geo_lng: hasCoords ? Number(form.geo_lng.trim()) : null,
        special_requirements: form.special_requirements.trim() || null,
        images: uploadedUrls,
      };

      // Submit exactly once with idempotency key protection.
      await createProject(payload, idempotencyKeyRef.current);
      await AsyncStorage.removeItem(DRAFT_KEY);

      // Reset wizard state so reopening CreateJob starts fresh
      setForm(INITIAL);
      setImages([]);
      setStep(0);
      setErrors({});
      uploadedUrlsRef.current = {};
      idempotencyKeyRef.current = '';

      Alert.alert(
        'Project submitted',
        'Your project has been created and submitted for review.',
        [
          {
            text: 'View My Projects',
            onPress: () => router.replace('/(tabs)/projects'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Could not publish project',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
      setUploadStatus('');
    }
  }

  const field = (
    label: string,
    key: keyof ProjectForm,
    placeholder: string,
    options: {
      multiline?: boolean;
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      helper?: string;
    } = {},
  ) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={String(form[key] ?? '')}
        onChangeText={(value) => update(key, value as never)}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        multiline={options.multiline}
        keyboardType={options.keyboardType ?? 'default'}
        textAlignVertical={options.multiline ? 'top' : 'center'}
        style={[
          styles.input,
          options.multiline && styles.multiline,
          errors[key] && styles.inputError,
        ]}
      />

      {options.helper ? (
        <Text style={styles.helper}>{options.helper}</Text>
      ) : null}

      {errors[key] ? (
        <Text style={styles.error}>{errors[key]}</Text>
      ) : null}
    </View>
  );

  const selectField = (
    label: string,
    value: string,
    items: SelectionOption[],
    onSelect: (value: string) => void,
    errorKey?: string,
    subtitle?: string,
  ) => {
    const selected = items.find((item) => item.value === value);

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? 'Select'}`}
          onPress={() => openSelector(label, value, items, onSelect, subtitle)}
          style={({ pressed }) => [
            styles.selectTrigger,
            pressed && styles.selectTriggerPressed,
            errorKey && errors[errorKey] ? styles.inputError : null,
          ]}
        >
          <View style={styles.selectIcon}>
            <Text style={styles.selectIconText}>
              {selected ? '✓' : '⌄'}
            </Text>
          </View>

          <View style={styles.selectTextWrap}>
            <Text style={styles.selectValue}>
              {selected?.label ?? `Select ${label.toLowerCase()}`}
            </Text>
            {selected?.description ? (
              <Text style={styles.selectDescription} numberOfLines={1}>
                {selected.description}
              </Text>
            ) : null}
          </View>

          <Text style={styles.selectChevron}>›</Text>
        </Pressable>

        {errorKey && errors[errorKey] ? (
          <Text style={styles.error}>{errors[errorKey]}</Text>
        ) : null}
      </View>
    );
  };

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>01</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Project details</Text>
                <Text style={styles.sectionDescription}>
                  Give your project a clear identity.
                </Text>
              </View>
            </View>

            {field('Project title *', 'title', 'e.g. Warehouse construction')}

            {field(
              'Project description *',
              'description',
              'Describe the work, responsibilities and expected outcome...',
              { multiline: true },
            )}

            {selectField(
              'Project type *',
              form.project_type,
              PROJECT_TYPES,
              (value) =>
                update('project_type', value as ProjectForm['project_type']),
            )}
          </View>
        );

      case 1:
        return (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>02</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Workforce requirements</Text>
                <Text style={styles.sectionDescription}>
                  Select the type of workforce and service you need.
                </Text>
              </View>
            </View>

            {selectField(
              'Worker category *',
              form.worker_category,
              WORKER_CATEGORIES,
              (value) => {
                update('worker_category', value);
                update('trade_type', '');
              },
              'worker_category',
            )}

            {selectField(
              'Trade / service *',
              form.trade_type,
              tradeOptions,
              (value) => update('trade_type', value),
              'trade_type',
              'Choose a service from the available list.',
            )}

            {skills.length === 0 ? (
              <Pressable
                onPress={fetchAvailableSkills}
                disabled={loadingSkills}
                style={styles.notice}
              >
                <Text style={styles.noticeText}>
                  {loadingSkills
                    ? 'Loading trade options...'
                    : 'No trade options loaded yet. Tap here to retry.'}
                </Text>
              </Pressable>
            ) : null}

            {field(
              'Number of workers *',
              'total_workers_required',
              'e.g. 20',
              { keyboardType: 'numeric' },
            )}

            <View style={styles.inlineTip}>
              <Text style={styles.inlineTipIcon}>✦</Text>
              <Text style={styles.inlineTipText}>
                Clear workforce requirements help your project reach the
                right applicants.
              </Text>
            </View>
          </View>
        );

      case 2:
        return (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Text style={styles.sectionIconText}>03</Text>
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Budget & timeline</Text>
                  <Text style={styles.sectionDescription}>
                    Set a clear compensation structure.
                  </Text>
                </View>
              </View>

              {selectField(
                'Payment method *',
                form.wage_type,
                WAGE_TYPES,
                (value) =>
                  update('wage_type', value as ProjectForm['wage_type']),
              )}

              {form.wage_type === 'PER_DAY_WAGE' ? (
                <View style={styles.twoColumns}>
                  <View style={styles.column}>
                    {field(
                      'Minimum wage (₹/day) *',
                      'wage_min',
                      '600',
                      { keyboardType: 'decimal-pad' },
                    )}
                  </View>
                  <View style={styles.column}>
                    {field(
                      'Maximum wage (₹/day) *',
                      'wage_max',
                      '900',
                      { keyboardType: 'decimal-pad' },
                    )}
                  </View>
                </View>
              ) : (
                field(
                  'Total contract price (₹) *',
                  'contract_price',
                  'e.g. 250000',
                  { keyboardType: 'decimal-pad' },
                )
              )}

              {field(
                'Project duration (days) *',
                'duration_days',
                'e.g. 30',
                { keyboardType: 'numeric' },
              )}

              {field(
                'Expected start date',
                'start_date',
                'YYYY-MM-DD',
                {
                  helper: 'Optional. Enter the date as year-month-day.',
                },
              )}
            </View>

            <View style={styles.budgetNote}>
              <Text style={styles.budgetNoteTitle}>Keep it transparent</Text>
              <Text style={styles.budgetNoteText}>
                Make the payment structure and expected duration clear to
                help applicants understand your project.
              </Text>
            </View>
          </>
        );

      case 3:
        return (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>04</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Project site address</Text>
                <Text style={styles.sectionDescription}>
                  Enter the location where the work will happen.
                </Text>
              </View>
            </View>

            {field(
              'Project site address *',
              'location',
              'Building, street, area, city and PIN code',
              { multiline: true },
            )}

            {field(
              'Special requirements',
              'special_requirements',
              'Safety equipment, shift timings, site access or other instructions...',
              { multiline: true },
            )}

            <View style={styles.twoColumns}>
              <View style={styles.column}>
                {field('Site latitude (optional)', 'geo_lat', 'e.g. 28.6280', {
                  keyboardType: 'decimal-pad',
                })}
              </View>
              <View style={styles.column}>
                {field('Site longitude (optional)', 'geo_lng', 'e.g. 77.3760', {
                  keyboardType: 'decimal-pad',
                })}
              </View>
            </View>

            <View style={styles.addressNote}>
              <Text style={styles.addressNoteIcon}>⌖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressNoteTitle}>
                  Site address, not your current location
                </Text>
                <Text style={styles.addressNoteText}>
                  You can post this project from home or anywhere else.
                </Text>
              </View>
            </View>
          </View>
        );
     case 4:
        return (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>05</Text>
              </View>

              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Project photos</Text>
                <Text style={styles.sectionDescription}>
                  Help applicants understand the work and site.
                </Text>
              </View>
            </View>

            <View style={styles.photoRequirement}>
              <View style={styles.photoRequirementIcon}>
                <Text style={styles.photoRequirementIconText}>✓</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.photoRequirementTitle}>
                  At least one photo is required
                </Text>
                <Text style={styles.photoRequirementText}>
                  Add site photos, project plans or reference images.
                  You can select up to 10.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => chooseImages('gallery')}
              style={({ pressed }) => [
                styles.uploadDropzone,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>↑</Text>
              </View>

              <Text style={styles.uploadTitle}>
                {images.length > 0
                  ? 'Add more photos'
                  : 'Upload project photos'}
              </Text>

              <Text style={styles.uploadSubtitle}>
                Choose images from your device
              </Text>

              <View style={styles.uploadButton}>
                <Text style={styles.uploadButtonText}>
                  Choose photos
                </Text>
              </View>

              <Text style={styles.photoCount}>
                {images.length} of {MAX_IMAGES} selected
              </Text>
            </Pressable>

            {errors.images ? (
              <Text style={styles.error}>{errors.images}</Text>
            ) : null}

            {images.length > 0 ? (
              <View>
                <View style={styles.photoListHeader}>
                  <Text style={styles.photoListTitle}>
                    Selected photos
                  </Text>
                  <Text style={styles.photoListSubtitle}>
                    Tap × to remove
                  </Text>
                </View>

                <View style={styles.imageGrid}>
                  {images.map((image, index) => (
                    <View
                      key={`${image.uri}-${index}`}
                      style={styles.imageContainer}
                    >
                      <Image
                        source={{ uri: image.uri }}
                        style={styles.image}
                      />

                      <View style={styles.imageNumber}>
                        <Text style={styles.imageNumberText}>
                          {index + 1}
                        </Text>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${index + 1}`}
                        style={styles.removeImage}
                        onPress={() => {
                          setImages((current) =>
                            current.filter((_, i) => i !== index),
                          );
                          setErrors((current) => {
                            const next = { ...current };
                            delete next.images;
                            return next;
                          });
                        }}
                      >
                        <Text style={styles.removeImageText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              style={styles.cameraButton}
              onPress={() => chooseImages('camera')}
            >
              <Text style={styles.cameraButtonText}>
                ＋ Take a photo
              </Text>
            </Pressable>

            <Text style={styles.helper}>
              Photos will upload when you publish your project.
            </Text>
          </View>
        );

      default:
        return (
          <>
            <View style={styles.reviewIntro}>
              <View style={styles.reviewSuccessIcon}>
                <Text style={styles.reviewSuccessIconText}>✓</Text>
              </View>
              <Text style={styles.reviewIntroTitle}>Everything in one place</Text>
              <Text style={styles.reviewIntroText}>
                Review your project details before submitting.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.reviewSectionHeader}>
                <Text style={styles.sectionTitle}>Project details</Text>
                <Pressable onPress={() => setStep(0)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              </View>

              <Text style={styles.reviewProjectTitle}>
                {form.title}
              </Text>
              <Text style={styles.reviewProjectDescription}>
                {form.description}
              </Text>

              <View style={styles.reviewDivider} />

              {[
                [
                  'Project type',
                  PROJECT_TYPES.find((item) => item.value === form.project_type)?.label ?? form.project_type,
                ],
                [
                  'Worker category',
                  WORKER_CATEGORIES.find((item) => item.value === form.worker_category)?.label ?? form.worker_category,
                ],
                [
                  'Trade / service',
                  skills.find((item) => item.id === form.trade_type)?.name ?? form.trade_type,
                ],
                ['Workers required', form.total_workers_required],
              ].map(([label, value]) => (
                <View style={styles.reviewRow} key={label}>
                  <Text style={styles.reviewLabel}>{label}</Text>
                  <Text style={styles.reviewValue}>{value || '—'}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.reviewSectionHeader}>
                <Text style={styles.sectionTitle}>Budget & timeline</Text>
                <Pressable onPress={() => setStep(2)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              </View>

              {[
                [
                  'Payment method',
                  form.wage_type === 'PER_DAY_WAGE' ? 'Daily wages' : 'Fixed contract',
                ],
                [
                  'Compensation',
                  form.wage_type === 'PER_DAY_WAGE'
                    ? `₹${form.wage_min} – ₹${form.wage_max} / day`
                    : `₹${form.contract_price} total`,
                ],
                ['Duration', `${form.duration_days} days`],
                ['Start date', form.start_date || 'Not specified'],
              ].map(([label, value]) => (
                <View style={styles.reviewRow} key={label}>
                  <Text style={styles.reviewLabel}>{label}</Text>
                  <Text style={styles.reviewValue}>{value || '—'}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.reviewSectionHeader}>
                <Text style={styles.sectionTitle}>Site information</Text>
                <Pressable onPress={() => setStep(3)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              </View>

              <Text style={styles.reviewAddress}>{form.location}</Text>

              {form.special_requirements.trim() ? (
                <>
                  <View style={styles.reviewDivider} />
                  <Text style={styles.reviewLabel}>Special requirements</Text>
                  <Text style={styles.reviewProjectDescription}>
                    {form.special_requirements}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.reviewSectionHeader}>
                <Text style={styles.sectionTitle}>Project photos</Text>
                <Pressable onPress={() => setStep(4)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.reviewPhotoSummary}>
                <Text style={styles.reviewPhotoCount}>{images.length}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewPhotoTitle}>
                    {images.length === 1 ? 'Photo selected' : 'Photos selected'}
                  </Text>
                  <Text style={styles.reviewPhotoDescription}>
                    Your photos will upload when you publish.
                  </Text>
                </View>
                <Text style={styles.reviewPhotoCheck}>✓</Text>
              </View>
            </View>

            <View style={styles.publishNotice}>
              <Text style={styles.publishNoticeIcon}>✓</Text>
              <Text style={styles.publishNoticeText}>
                Your project will be submitted once. Please check the details
                above before publishing.
              </Text>
            </View>
          </>
        );
    }
  }

  if (!restored) {
    return (
      <SafeAreaView
        style={styles.loading}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <ActivityIndicator size="large" color={C.dark} />
        <Text style={styles.loadingText}>Preparing your project...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.flex}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        backgroundColor={C.surface}
        translucent
        animated
      />
      <SafeAreaView edges={['top']} style={styles.topInset} />
      <SafeAreaView
        style={styles.safeArea}
        edges={['left', 'right', 'bottom']}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              if (step > 0) previousStep();
              else router.back();
            }}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.brandEyebrow}>HEADSUP WORKSPACE</Text>
            <Text style={styles.headerTitle}>Create a project</Text>
          </View>

          <View style={styles.draftBadge}>
            <View style={styles.draftDot} />
            <Text style={styles.draftBadgeText}>Draft</Text>
          </View>
        </View>

        <View style={styles.progressArea}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>
              STEP {String(step + 1).padStart(2, '0')} OF 06
            </Text>
            <Text style={styles.progressPercent}>
              {Math.round(((step + 1) / STEPS.length) * 100)}%
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((step + 1) / STEPS.length) * 100}%` },
              ]}
            />
          </View>

          <View style={styles.stepLabels}>
            {STEPS.map((item, index) => (
              <View style={styles.stepLabelItem} key={item.title}>
                <View
                  style={[
                    styles.stepIndicator,
                    index < step && styles.stepIndicatorDone,
                    index === step && styles.stepIndicatorActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepIndicatorText,
                      index <= step && styles.stepIndicatorTextActive,
                    ]}
                  >
                    {index < step ? '✓' : index + 1}
                  </Text>
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepLabelText,
                    index === step && styles.stepLabelTextActive,
                  ]}
                >
                  {['Overview', 'Workforce', 'Budget', 'Location', 'Photos', 'Review'][index]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageIntro}>
            <Text style={styles.pageEyebrow}>
              PROJECT SETUP / {String(step + 1).padStart(2, '0')}
            </Text>
            <Text style={styles.heading}>{STEPS[step].title}</Text>
            <Text style={styles.subtitle}>{STEPS[step].subtitle}</Text>
          </View>

          {renderStep()}

          <Text style={styles.draftNote}>
            Your progress is saved on this device as you type.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerTitle}>
              {step === 5 ? 'Ready to submit?' : 'Take your time'}
            </Text>
            <Text style={styles.footerHint}>
              Step {step + 1} of {STEPS.length}
            </Text>
          </View>

          <Pressable
            disabled={saving}
            onPress={step < STEPS.length - 1 ? nextStep : publish}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !saving && styles.primaryButtonPressed,
              saving && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={C.dark} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {step < 4
                  ? 'Continue  →'
                  : step === 4
                    ? 'Review project  →'
                    : 'Publish project  ↗'}
              </Text>
            )}
          </Pressable>
        </View>

        {saving ? (
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingCard}>
              <ActivityIndicator size="large" color={C.dark} />
              <Text style={styles.uploadingTitle}>Publishing your project</Text>
              <Text style={styles.uploadingText}>
                {uploadStatus || 'Preparing your project photos...'}
              </Text>
              <Text style={styles.uploadingFootnote}>
                Please keep the app open until publishing finishes.
              </Text>
            </View>
          </View>
        ) : null}

        <Modal
          visible={selectionSheet !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectionSheet(null)}
        >
          <View style={styles.sheetBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectionSheet(null)}
              accessibilityLabel="Close selector"
            />

            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.sheetEyebrow}>HEADSUP · SELECT</Text>
                  <Text style={styles.sheetTitle}>
                    {selectionSheet?.title}
                  </Text>
                  {selectionSheet?.subtitle ? (
                    <Text style={styles.sheetSubtitle}>
                      {selectionSheet.subtitle}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close selector"
                  onPress={() => setSelectionSheet(null)}
                  style={styles.sheetClose}
                >
                  <Text style={styles.sheetCloseText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.sheetList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {selectionSheet?.items.map((item, index) => {
                  const selected = item.value === selectionSheet.value;

                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => {
                        selectionSheet.onSelect(item.value);
                        setSelectionSheet(null);
                      }}
                      style={({ pressed }) => [
                        styles.sheetOption,
                        selected && styles.sheetOptionSelected,
                        pressed && styles.sheetOptionPressed,
                      ]}
                    >
                      <View style={styles.sheetOptionIndex}>
                        <Text style={styles.sheetOptionIndexText}>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                      </View>

                      <View style={styles.sheetOptionBody}>
                        <Text
                          style={[
                            styles.sheetOptionText,
                            selected && styles.sheetOptionTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.description ? (
                          <Text style={styles.sheetOptionDescription}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.sheetRadio,
                          selected && styles.sheetRadioSelected,
                        ]}
                      >
                        {selected ? <View style={styles.sheetRadioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}

                {selectionSheet?.items.length === 0 ? (
                  <View style={styles.emptyOptions}>
                    <Text style={styles.emptyOptionsTitle}>
                      No options available
                    </Text>
                    <Text style={styles.emptyOptionsText}>
                      Check your connection and try again.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topInset: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: C.surface,
  },
  safeArea: { flex: 1, backgroundColor: C.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: C.background,
  },
  loadingText: { color: C.muted, fontSize: 13 },

  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 30, lineHeight: 34, color: C.text },
  headerTitleWrap: { flex: 1 },
  brandEyebrow: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 17, fontWeight: '900', color: C.text },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: C.subtle,
  },
  draftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  draftBadgeText: { fontSize: 10, fontWeight: '800', color: C.muted },

  progressArea: {
    paddingHorizontal: 22,
    paddingTop: 17,
    paddingBottom: 17,
    backgroundColor: C.surface,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  progressLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  progressPercent: { color: C.text, fontSize: 11, fontWeight: '900' },
  progressTrack: {
    height: 5,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: C.yellow,
    borderRadius: 4,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  stepLabelItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  stepIndicator: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: C.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  stepIndicatorActive: {
    backgroundColor: C.yellow,
    borderColor: C.yellow,
  },
  stepIndicatorDone: {
    backgroundColor: C.dark,
    borderColor: C.dark,
  },
  stepIndicatorText: { color: C.muted, fontSize: 10, fontWeight: '900' },
  stepIndicatorTextActive: { color: C.dark },
  stepLabelText: { color: C.muted, fontSize: 9, fontWeight: '600' },
  stepLabelTextActive: { color: C.text, fontWeight: '900' },

  content: { padding: 20, paddingBottom: 30 },
  pageIntro: { marginBottom: 20 },
  pageEyebrow: {
    color: '#7A5D00',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heading: {
    color: C.text,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },

  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.yellowLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconText: { color: '#7A5D00', fontSize: 12, fontWeight: '700' },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  sectionDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  field: { marginBottom: 18 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD3C0',
    backgroundColor: '#FFFFFF',
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  multiline: { minHeight: 112, paddingTop: 14 },
  inputError: { borderColor: C.danger },
  error: { fontSize: 12, color: C.danger, marginTop: 7 },
  helper: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },

  selectTrigger: {
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  selectTriggerPressed: {
    borderColor: C.yellow,
    backgroundColor: '#FFFDF4',
  },
  selectIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: C.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIconText: { color: C.text, fontSize: 14, fontWeight: '900' },
  selectTextWrap: { flex: 1 },
  selectValue: { color: C.text, fontSize: 14, fontWeight: '800' },
  selectDescription: { color: C.muted, fontSize: 11, marginTop: 4 },
  selectChevron: { color: C.muted, fontSize: 25, marginLeft: 5 },

  twoColumns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1 },
  inlineTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8F9FB',
    borderRadius: 13,
    padding: 13,
    marginTop: 2,
  },
  inlineTipIcon: { color: '#9B7800', fontSize: 17, fontWeight: '900' },
  inlineTipText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  budgetNote: {
    backgroundColor: C.yellowLight,
    borderRadius: 17,
    padding: 17,
    marginBottom: 15,
  },
  budgetNoteTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  budgetNoteText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  addressNote: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 15,
    backgroundColor: '#F7F8FA',
    padding: 14,
    marginBottom: 5,
  },
  addressNoteIcon: { color: C.text, fontSize: 24, fontWeight: '700' },
  addressNoteTitle: { color: C.text, fontSize: 12, fontWeight: '900' },
  addressNoteText: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  notice: {
    backgroundColor: '#FFF3F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { color: C.danger, fontSize: 12, lineHeight: 18 },

  photoRequirement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#F7F8FA',
    marginBottom: 18,
  },
  photoRequirementIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAF7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRequirementIconText: { color: C.success, fontSize: 14, fontWeight: '900' },
  photoRequirementTitle: { color: C.text, fontSize: 12, fontWeight: '900' },
  photoRequirementText: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D8C99F',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#FFFDF6',
  },
  uploadIcon: {
    width: 51,
    height: 51,
    borderRadius: 17,
    backgroundColor: C.yellowLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadIconText: { fontSize: 28, fontWeight: '500', color: C.dark },
  uploadTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  uploadSubtitle: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 7,
  },
  uploadButton: {
    backgroundColor: C.yellow,
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginTop: 16,
  },
  uploadButtonText: { color: C.dark, fontSize: 12, fontWeight: '900' },
  photoCount: {
    color: C.success,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 13,
  },
  photoListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 4,
  },
  photoListTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
  photoListSubtitle: { color: C.muted, fontSize: 10 },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 15,
  },
  imageContainer: {
    width: '30%',
    aspectRatio: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    backgroundColor: C.subtle,
  },
  imageNumber: {
    position: 'absolute',
    left: 5,
    top: 5,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#FFFFFF',
  },
  imageNumberText: { color: C.text, fontSize: 9, fontWeight: '900' },
  removeImage: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: C.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: { color: '#FFFFFF', fontSize: 19, lineHeight: 22 },
  cameraButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  cameraButtonText: { color: C.text, fontWeight: '800', fontSize: 12 },

  reviewIntro: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 14,
  },
  reviewSuccessIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAF7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  reviewSuccessIconText: { color: C.success, fontSize: 21, fontWeight: '900' },
  reviewIntroTitle: { color: C.text, fontSize: 20, fontWeight: '900' },
  reviewIntroText: {
    color: C.muted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  editLink: { color: '#886700', fontSize: 12, fontWeight: '900' },
  reviewProjectTitle: {
    color: C.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
  },
  reviewProjectDescription: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 15,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 15,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
  },
  reviewLabel: { fontSize: 12, color: C.muted, flex: 0.8 },
  reviewValue: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    textAlign: 'right',
    flex: 1.2,
  },
  reviewAddress: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  reviewPhotoSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
  },
  reviewPhotoCount: { color: C.text, fontSize: 23, fontWeight: '900' },
  reviewPhotoTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  reviewPhotoDescription: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  reviewPhotoCheck: { color: C.success, fontSize: 19, fontWeight: '900' },
  publishNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EAF7F0',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
  },
  publishNoticeIcon: { color: C.success, fontSize: 17, fontWeight: '900' },
  publishNoticeText: {
    color: '#276749',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  draftNote: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'center',
    marginTop: 7,
  },
  footer: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'android' ? 13 : 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerInfo: { flex: 1 },
  footerTitle: { color: C.text, fontSize: 12, fontWeight: '900' },
  footerHint: { color: C.muted, fontSize: 10, marginTop: 4 },
  primaryButton: {
    minHeight: 51,
    borderRadius: 15,
    paddingHorizontal: 19,
    backgroundColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  primaryButtonPressed: { backgroundColor: '#E9B923' },
  primaryButtonText: { color: C.dark, fontWeight: '900', fontSize: 12 },
  disabledButton: { opacity: 0.65 },

  uploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(247,248,250,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },
  uploadingCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  uploadingTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 18,
  },
  uploadingText: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  uploadingFootnote: {
    color: C.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },

  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,24,40,0.48)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: C.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 25 : 30,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D0D5DD',
    alignSelf: 'center',
    marginBottom: 22,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  sheetHeaderText: { flex: 1 },
  sheetEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: C.muted,
    marginBottom: 7,
  },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: C.text },
  sheetSubtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  sheetClose: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: { fontSize: 24, color: C.text },
  sheetList: { flexGrow: 0 },
  sheetOption: {
    minHeight: 65,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetOptionSelected: {
    borderColor: '#E6BD34',
    backgroundColor: '#FFF9DF',
  },
  sheetOptionPressed: { opacity: 0.8 },
  sheetOptionIndex: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionIndexText: { fontSize: 10, fontWeight: '900', color: C.muted },
  sheetOptionBody: { flex: 1 },
  sheetOptionText: { fontSize: 14, fontWeight: '700', color: C.text },
  sheetOptionTextSelected: { fontWeight: '900' },
  sheetOptionDescription: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  sheetRadio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRadioSelected: { borderColor: C.dark },
  sheetRadioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.dark,
  },
  emptyOptions: { alignItems: 'center', padding: 28 },
  emptyOptionsTitle: { color: C.text, fontSize: 15, fontWeight: '900' },
  emptyOptionsText: {
    color: C.muted,
    fontSize: 12,
    marginTop: 7,
    textAlign: 'center',
  },
});
