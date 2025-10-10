import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  IndexTable,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../../shopify.server";
// import { useState } from "react";
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
        product: {
          title: `${color} Snowboard`,
        },
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
        productVariants {
          id
          price
          barcode
          createdAt
        }
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
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();

  const shopify = useAppBridge();

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  return (
    <Page title="Pricing Plans">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Text variant="heading2xl" as="h1" alignment="center">
              Choose the right plan for your store
            </Text>
            <InlineStack gap="400" align="center" wrap={false}>
              {/* Free Plan */}
              <Card>
                <BlockStack gap="300" align="center">
                  <Text variant="headingLg" as="h2">
                    Free
                  </Text>
                  <Text as="p">$0 / month</Text>
                  <List type="bullet">
                    <List.Item>Basic image translation</List.Item>
                    <List.Item>Up to 50 images</List.Item>
                  </List>
                  <Button variant="primary" tone="success">
                    Start Free
                  </Button>
                </BlockStack>
              </Card>

              {/* Pro Plan */}
              <Card>
                <BlockStack gap="300" align="center">
                  <Text variant="headingLg" as="h2">
                    Pro
                  </Text>
                  <Text as="p">$19 / month</Text>
                  <List type="bullet">
                    <List.Item>Unlimited image translations</List.Item>
                    <List.Item>Priority support</List.Item>
                  </List>
                  <Button variant="primary">Upgrade</Button>
                </BlockStack>
              </Card>

              {/* Enterprise Plan */}
              <Card>
                <BlockStack gap="300" align="center">
                  <Text variant="headingLg" as="h2">
                    Enterprise
                  </Text>
                  <Text as="p">Custom Pricing</Text>
                  <List type="bullet">
                    <List.Item>Dedicated account manager</List.Item>
                    <List.Item>Custom integrations</List.Item>
                  </List>
                  <Button>Contact Sales</Button>
                </BlockStack>
              </Card>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
