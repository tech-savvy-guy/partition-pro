-- Baseline SQL managed by Django migrations.
-- Source: db/schema/10_app_schemas.sql schema-only dump from Azure dev.
-- Do not put row data, credentials, owners, or grants in this file.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
--
-- TOC entry 287 (class 1259 OID 127669)
-- Name: basemath_edges; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.basemath_edges (
    case_id uuid NOT NULL,
    pp_basemath_id uuid NOT NULL,
    sku_l text NOT NULL,
    sku_r text NOT NULL,
    roi double precision
);

--
-- TOC entry 223 (class 1259 OID 24838)
-- Name: cases; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by text NOT NULL,
    created_on timestamp with time zone NOT NULL,
    updated_by text,
    updated_on timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    case_name text NOT NULL,
    methodology text NOT NULL,
    case_code text NOT NULL,
    requested_by text NOT NULL,
    case_manager text NOT NULL,
    nps_contact text NOT NULL,
    status text,
    product_type text,
    category text NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    end_date timestamp with time zone,
    is_archived boolean DEFAULT false NOT NULL,
    description text NOT NULL,
    tenant_id uuid NOT NULL,
    is_preprocessed boolean DEFAULT false NOT NULL,
    final_answer uuid,
    super_category character varying(255)
);

--
-- TOC entry 286 (class 1259 OID 37621)
-- Name: changelogs; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.changelogs (
    id uuid NOT NULL,
    created_on timestamp with time zone,
    heading text,
    description text,
    created_by text
);

--
-- TOC entry 224 (class 1259 OID 24847)
-- Name: dataset_metadata; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.dataset_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by text NOT NULL,
    created_on timestamp with time zone NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    case_id uuid NOT NULL,
    data_type text NOT NULL,
    file_name text NOT NULL,
    version integer NOT NULL,
    description text,
    file_size numeric,
    blob_name text NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'Processing'::text NOT NULL,
    is_selected boolean DEFAULT false NOT NULL
);

--
-- TOC entry 288 (class 1259 OID 131189)
-- Name: partition_dataset_metadata; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.partition_dataset_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_on timestamp with time zone DEFAULT now() NOT NULL,
    created_by text NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    case_id uuid NOT NULL,
    partition_id uuid NOT NULL,
    data_type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    file_name text NOT NULL,
    file_size numeric(20,2),
    blob_name text NOT NULL,
    description text,
    status text DEFAULT 'Ready'::text NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_selected boolean DEFAULT true NOT NULL
);

--
-- TOC entry 225 (class 1259 OID 24857)
-- Name: partitions; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.partitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by text NOT NULL,
    created_on timestamp with time zone NOT NULL,
    updated_by text,
    updated_on timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    case_id uuid NOT NULL,
    partition_name text NOT NULL,
    description text NOT NULL,
    base_partition uuid,
    status text NOT NULL,
    end_date timestamp with time zone,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    step_status text NOT NULL,
    is_shared boolean DEFAULT false NOT NULL,
    ppm_id uuid NOT NULL,
    locked_by_id uuid,
    locked_by_name text,
    lock_expires_at timestamp with time zone
);

--
-- TOC entry 226 (class 1259 OID 24866)
-- Name: partitions_raw_dataset_mapping; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.partitions_raw_dataset_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partition_id uuid NOT NULL,
    dataset_id uuid NOT NULL,
    data_type text NOT NULL,
    tags jsonb NOT NULL
);

--
-- TOC entry 222 (class 1259 OID 24830)
-- Name: preprocessed_base_math; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.preprocessed_base_math (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    pp_metadata_id uuid NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 283 (class 1259 OID 29288)
-- Name: preprocessed_metadata; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.preprocessed_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_on timestamp with time zone NOT NULL,
    case_id uuid NOT NULL,
    att_dataset_id uuid NOT NULL,
    pos_dataset_id uuid NOT NULL,
    cp_dataset_id uuid NOT NULL,
    version bigint NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- TOC entry 282 (class 1259 OID 28476)
-- Name: preprocessed_sku_selection; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.preprocessed_sku_selection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    pp_metadata_id uuid NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 227 (class 1259 OID 24872)
-- Name: raw_attributes_data; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
)
PARTITION BY HASH (case_id);

--
-- TOC entry 228 (class 1259 OID 24878)
-- Name: raw_attributes_data_p0; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p0 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 229 (class 1259 OID 24886)
-- Name: raw_attributes_data_p1; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p1 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 230 (class 1259 OID 24894)
-- Name: raw_attributes_data_p2; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 231 (class 1259 OID 24902)
-- Name: raw_attributes_data_p3; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p3 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 232 (class 1259 OID 24910)
-- Name: raw_attributes_data_p4; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p4 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 233 (class 1259 OID 24918)
-- Name: raw_attributes_data_p5; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p5 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 234 (class 1259 OID 24926)
-- Name: raw_attributes_data_p6; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p6 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 235 (class 1259 OID 24934)
-- Name: raw_attributes_data_p7; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_attributes_data_p7 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 236 (class 1259 OID 24942)
-- Name: raw_cross_purchase_data; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
)
PARTITION BY HASH (case_id);

--
-- TOC entry 237 (class 1259 OID 24948)
-- Name: raw_cross_purchase_data_p0; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p0 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 238 (class 1259 OID 24956)
-- Name: raw_cross_purchase_data_p1; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p1 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 239 (class 1259 OID 24964)
-- Name: raw_cross_purchase_data_p2; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 240 (class 1259 OID 24972)
-- Name: raw_cross_purchase_data_p3; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p3 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 241 (class 1259 OID 24980)
-- Name: raw_cross_purchase_data_p4; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p4 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 242 (class 1259 OID 24988)
-- Name: raw_cross_purchase_data_p5; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p5 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 243 (class 1259 OID 24996)
-- Name: raw_cross_purchase_data_p6; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p6 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 244 (class 1259 OID 25004)
-- Name: raw_cross_purchase_data_p7; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_cross_purchase_data_p7 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 289 (class 1259 OID 131216)
-- Name: raw_grouping_data; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_grouping_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    partition_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    row_num bigint NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- TOC entry 245 (class 1259 OID 25012)
-- Name: raw_pos_data; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
)
PARTITION BY HASH (case_id);

--
-- TOC entry 246 (class 1259 OID 25018)
-- Name: raw_pos_data_p0; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p0 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 247 (class 1259 OID 25026)
-- Name: raw_pos_data_p1; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p1 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 248 (class 1259 OID 25034)
-- Name: raw_pos_data_p2; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 249 (class 1259 OID 25042)
-- Name: raw_pos_data_p3; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p3 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 250 (class 1259 OID 25050)
-- Name: raw_pos_data_p4; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p4 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 251 (class 1259 OID 25058)
-- Name: raw_pos_data_p5; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p5 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 252 (class 1259 OID 25066)
-- Name: raw_pos_data_p6; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p6 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 253 (class 1259 OID 25074)
-- Name: raw_pos_data_p7; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.raw_pos_data_p7 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    version integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_num bigint DEFAULT 0 NOT NULL
);

--
-- TOC entry 254 (class 1259 OID 25082)
-- Name: user_assignments; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.user_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_on timestamp with time zone,
    created_by text,
    updated_on timestamp with time zone,
    updated_by text,
    is_deleted boolean DEFAULT false NOT NULL,
    case_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- TOC entry 255 (class 1259 OID 25090)
-- Name: workflows; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    updated_by text,
    updated_on timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    case_id uuid NOT NULL,
    partition_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL,
    step_number integer DEFAULT 1 NOT NULL
);

--
-- TOC entry 290 (class 1259 OID 131545)
-- Name: working_attributes_data; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.working_attributes_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grouping_metadata_id uuid NOT NULL,
    case_id uuid NOT NULL,
    partition_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    row_num bigint NOT NULL,
    data jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);


