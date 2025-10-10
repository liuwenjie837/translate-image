import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  InlineStack,
  Pagination,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../../shopify.server";
import { Table, Checkbox, Image } from "antd";
import type { ColumnsType } from "antd/es/table";

interface ImageItem {
  id: string;
  src: string;
  section: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: { title: `${color} Snowboard` },
      },
    },
  );

  const responseJson = await response.json();
  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price barcode createdAt }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const initStoreDataFetcher = useFetcher<any>();
  const shopify = useAppBridge();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [images, setImages] = useState<any>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [cursor, setCursor] = useState<{ start: any; end: any }>({
    start: "",
    end: "",
  });
  const [hasMore, setHasMore] = useState(true);
  const [hasPrev, setHasPrev] = useState(true);

  const fetchImages = (
    cursor: string | null = null,
    direction: "next" | "prev" = "next",
  ) => {
    const formData = new FormData();
    if (direction === "next") {
      formData.append(
        "initDataFetcher",
        JSON.stringify({ type: "next", num: 5, cursor: cursor }),
      );
    } else {
      formData.append(
        "initDataFetcher",
        JSON.stringify({ type: "prev", num: 5, cursor: cursor }),
      );
    }

    initStoreDataFetcher.submit(formData, {
      action: "/app",
      method: "POST",
    });
  };

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    if (initStoreDataFetcher.data) {
      console.log(initStoreDataFetcher.data);

      const newImages = initStoreDataFetcher.data.response.edges.map(
        (e: any) => e.node,
      );
      const combined = [...images, ...newImages];
      const uniqueImages = Array.from(
        new Map(newImages.map((item: any) => [item.id, item])).values(),
      );

      setImages(uniqueImages);
      console.log(uniqueImages);

      setCursor({
        end: initStoreDataFetcher.data.response.pageInfo.endCursor,
        start: initStoreDataFetcher.data.response.pageInfo.startCursor,
      });
      setHasMore(initStoreDataFetcher.data.response.pageInfo.hasNextPage);
      setHasPrev(initStoreDataFetcher.data.response.pageInfo.hasPreviousPage);
      setIsLoading(false);
    }
  }, [initStoreDataFetcher]);

  const handleTranslate = () => {
    if (selectedRowKeys.length === 0) return;
    alert(`翻译这些图片: ${selectedRowKeys.join(", ")}`);
  };

  const generateProduct = () => fetcher.submit({}, { method: "POST" });
  const handleNextPage = () => {
    if (!hasMore) {
      console.log("已经是最后一页了");
      return;
    }
    fetchImages(cursor.end);
  };
  const handlePrePage = () => {
    if (!hasPrev) {
      console.log("已经到第一页了");
      return;
    }
    fetchImages(cursor.start, "prev");
  };

  // Ant Design Table 配置
  const columns: ColumnsType<ImageItem> = [
    {
      title: "图片",
      dataIndex: "image",
      key: "image",
      render: (image: any, record: any) => (
        <Image
          preview={false}
          src={image?.url}
          alt={image?.altText}
          style={{ width: 200 }}
        />
      ),
    },
    {
      title: "所属板块",
      dataIndex: "section",
      key: "section",
      render: (section, record: any) => <span>{record.__typename}</span>,
    },
    {
      title: "操作",
      key: "action",
      render: (_text, record) => (
        <InlineStack>
          <Button size="slim" onClick={() => console.log(record)}>
            翻译
          </Button>
          <Button size="slim" url={record.src}>
            查看
          </Button>
        </InlineStack>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <Page>
      <TitleBar title="Remix app template">
        <button variant="primary" onClick={generateProduct}>
          Generate a product
        </button>
      </TitleBar>
      <Pagination
        hasPrevious={hasPrev}
        onPrevious={handlePrePage}
        hasNext={hasMore}
        onNext={handleNextPage}
      />
      <Layout>
        <Layout.Section>
          <Card>
            <Table
              loading={isLoading}
              rowKey={(record) => record.id}
              rowSelection={rowSelection}
              columns={columns}
              dataSource={images}
              pagination={false}
            />
            <div style={{ marginTop: 16 }}>
              <Button
                onClick={handleTranslate}
                disabled={selectedRowKeys.length === 0}
              >
                批量翻译{" "}
                {selectedRowKeys.length > 0
                  ? `(${selectedRowKeys.length})`
                  : ""}
              </Button>
            </div>
            {hasMore && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <Button onClick={handleNextPage}>加载更多</Button>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
